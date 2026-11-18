import UIKit
import Capacitor

/// The game's only screen. A swipe from an edge must not end a run by accident, so the first edge swipe only
/// wakes the home indicator and a second is needed to leave.
class MainViewController: CAPBridgeViewController {
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var prefersStatusBarHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
}
