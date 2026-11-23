import Capacitor
import StoreKit

/// The one thing for sale: the unlock for races, cups and playing together. Everything is checked on the device
/// by StoreKit; nothing is sent anywhere else.
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tester", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lock", returnType: CAPPluginReturnPromise)
    ]

    private static let productID = "races_unlock"
    private var updates: Task<Void, Never>?

    /// Only a build run from Xcode. Nothing sent to TestFlight or the App Store has the switch.
    private static let isTester: Bool = {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }()
    private static let lockedKey = "tester.locked"

    /// A tester has asked to play as if the unlock were not owned. It can only ever shut the unlock, never open it.
    private static var testerLocked: Bool {
        get { isTester && UserDefaults.standard.bool(forKey: lockedKey) }
        set { UserDefaults.standard.set(newValue, forKey: lockedKey) }
    }

    /// Purchases approved later by a grown-up, made on another device, or refunded all arrive here.
    override public func load() {
        updates = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update { await transaction.finish() }
                guard let self else { return }
                // Kept until the page is listening: one can arrive at launch, before it has asked.
                self.notifyListeners("change", data: ["owned": await Self.isOwned()], retainUntilConsumed: true)
            }
        }
    }

    deinit { updates?.cancel() }

    private static func isOwned() async -> Bool {
        if testerLocked { return false }
        for await entitlement in Transaction.currentEntitlements {
            if case .verified(let transaction) = entitlement, transaction.productID == productID, transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }

    private static func find() async throws -> Product? {
        try await Product.products(for: [productID]).first
    }

    @objc func product(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Self.find() else { return call.reject("The unlock is not in the store") }
                call.resolve(["price": product.displayPrice])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func owned(_ call: CAPPluginCall) {
        Task { call.resolve(["owned": await Self.isOwned()]) }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Self.find() else { return call.reject("The unlock is not in the store") }
                switch try await product.purchase() {
                case .success(.verified(let transaction)):
                    await transaction.finish()
                    Self.testerLocked = false
                    call.resolve(["outcome": "bought"])
                case .success(.unverified):
                    call.resolve(["outcome": "failed"])
                case .pending:
                    call.resolve(["outcome": "pending"])
                case .userCancelled:
                    call.resolve(["outcome": "cancelled"])
                @unknown default:
                    call.resolve(["outcome": "failed"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Asks the store afresh what this Apple account owns. It can ask for the account's password, so only on a tap.
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                Self.testerLocked = false
                call.resolve(["owned": await Self.isOwned()])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Whether this is a tester's build, and whether the tester has shut the unlock to play without it.
    @objc func tester(_ call: CAPPluginCall) {
        call.resolve(["tester": Self.isTester, "locked": Self.testerLocked])
    }

    /// For testers only: play as if the unlock were not owned, or go back to what the store says.
    @objc func lock(_ call: CAPPluginCall) {
        guard Self.isTester else { return call.reject("Not a tester's build") }
        Self.testerLocked = call.getBool("locked") ?? false
        Task { call.resolve(["owned": await Self.isOwned()]) }
    }
}
