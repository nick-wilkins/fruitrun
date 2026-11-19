import Capacitor
import Network

/// Devices close by finding each other and passing short lines of text, over peer to peer Wi-Fi with no internet
/// and no router. One device hosts; the others find it by Bonjour and connect to it.
@objc(NearbyPlugin)
public class NearbyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NearbyPlugin"
    public let jsName = "Nearby"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "host", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "browse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "join", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leave", returnType: CAPPluginReturnPromise)
    ]

    private static let service = "_smoothierace._tcp"
    /// A line longer than this is not one of ours: whoever sent it is dropped.
    private static let longestLine = 64 * 1024

    private final class Peer {
        let connection: NWConnection
        var buffer = Data()
        init(_ connection: NWConnection) { self.connection = connection }
    }

    /// Everything below runs on this one queue.
    private let queue = DispatchQueue(label: "com.smoothiescramble.nearby")
    private var listener: NWListener?
    private var browser: NWBrowser?
    private var found: [String: NWEndpoint] = [:]
    private var peers: [String: Peer] = [:]

    private static func parameters() -> NWParameters {
        let tcp = NWProtocolTCP.Options()
        // Positions are small and frequent: send each at once, and notice quickly when the other end has gone.
        tcp.noDelay = true
        tcp.enableKeepalive = true
        tcp.keepaliveIdle = 2
        tcp.keepaliveInterval = 1
        tcp.keepaliveCount = 3
        let parameters = NWParameters(tls: nil, tcp: tcp)
        parameters.includePeerToPeer = true
        return parameters
    }

    @objc func host(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "Player"
        queue.async {
            self.stop()
            do {
                let listener = try NWListener(using: Self.parameters())
                listener.service = NWListener.Service(name: name, type: Self.service)
                listener.newConnectionHandler = { [weak self] connection in
                    self?.adopt(connection, as: UUID().uuidString)
                }
                listener.stateUpdateHandler = { [weak self] state in
                    switch state {
                    case .failed(let error), .waiting(let error): self?.fail(error)
                    default: break
                    }
                }
                listener.start(queue: self.queue)
                self.listener = listener
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func browse(_ call: CAPPluginCall) {
        queue.async {
            self.stop()
            let browser = NWBrowser(for: .bonjour(type: Self.service, domain: nil), using: Self.parameters())
            browser.browseResultsChangedHandler = { [weak self] results, _ in
                guard let self else { return }
                self.found = [:]
                var hosts: [[String: String]] = []
                for result in results {
                    if case .service(let name, _, _, _) = result.endpoint {
                        self.found[name] = result.endpoint
                        hosts.append(["id": name, "name": name])
                    }
                }
                self.notifyListeners("hosts", data: ["hosts": hosts])
            }
            browser.stateUpdateHandler = { [weak self] state in
                switch state {
                case .failed(let error), .waiting(let error): self?.fail(error)
                default: break
                }
            }
            browser.start(queue: self.queue)
            self.browser = browser
            call.resolve()
        }
    }

    @objc func join(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        queue.async {
            guard let endpoint = self.found[id] else { return call.reject("That game has gone") }
            self.browser?.cancel()
            self.browser = nil
            self.adopt(NWConnection(to: endpoint, using: Self.parameters()), as: "host")
            call.resolve()
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), let line = (text.replacingOccurrences(of: "\n", with: " ") + "\n").data(using: .utf8) else { return call.reject("Nothing to send") }
        let to = call.getString("to")
        queue.async {
            for (id, peer) in self.peers where to == nil || to == id {
                peer.connection.send(content: line, completion: .contentProcessed { _ in })
            }
            call.resolve()
        }
    }

    @objc func leave(_ call: CAPPluginCall) {
        queue.async {
            self.stop()
            call.resolve()
        }
    }

    /// Stop hosting, looking and talking. Nothing is announced: whoever asked knows.
    private func stop() {
        listener?.cancel()
        listener = nil
        browser?.cancel()
        browser = nil
        found = [:]
        let old = peers
        peers = [:]
        for peer in old.values { peer.connection.cancel() }
    }

    private func adopt(_ connection: NWConnection, as id: String) {
        let peer = Peer(connection)
        peers[id] = peer
        connection.stateUpdateHandler = { [weak self] state in
            guard let self, self.peers[id] === peer else { return }
            switch state {
            case .ready:
                self.notifyListeners("peer", data: ["id": id, "joined": true])
                self.receive(from: peer, id: id)
            case .failed, .cancelled, .waiting:
                self.drop(id)
            default:
                break
            }
        }
        connection.start(queue: queue)
    }

    private func drop(_ id: String) {
        guard let peer = peers.removeValue(forKey: id) else { return }
        peer.connection.cancel()
        notifyListeners("peer", data: ["id": id, "joined": false])
    }

    private func receive(from peer: Peer, id: String) {
        peer.connection.receive(minimumIncompleteLength: 1, maximumLength: 16 * 1024) { [weak self] data, _, done, error in
            guard let self, self.peers[id] === peer else { return }
            if let data {
                peer.buffer.append(data)
                while let end = peer.buffer.firstIndex(of: 0x0A) {
                    let line = peer.buffer.subdata(in: peer.buffer.startIndex..<end)
                    peer.buffer.removeSubrange(peer.buffer.startIndex...end)
                    if let text = String(data: line, encoding: .utf8), !text.isEmpty {
                        self.notifyListeners("message", data: ["from": id, "text": text])
                    }
                }
            }
            if done || error != nil || peer.buffer.count > Self.longestLine { return self.drop(id) }
            self.receive(from: peer, id: id)
        }
    }

    /// Being refused the local network is its own case: only a grown-up in Settings can put it right.
    private func fail(_ error: NWError) {
        var why = "error"
        if case .dns(let code) = error, code == kDNSServiceErr_PolicyDenied { why = "denied" }
        stop()
        notifyListeners("failed", data: ["why": why])
    }
}
