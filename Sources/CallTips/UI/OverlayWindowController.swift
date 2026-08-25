import AppKit
import SwiftUI

// Manages the floating overlay NSWindow shown during a call.
// Opened/closed by the menu-bar popover when recording starts/stops.
@MainActor
final class OverlayWindowController {
    private var window: NSWindow?

    func show(session: CallSession, onStop: @escaping () -> Void) {
        guard window == nil else { return }

        let content = NSHostingView(rootView:
            OverlayView(session: session, onStop: onStop)
        )
        content.setFrameSize(content.fittingSize)

        let w = NSWindow(
            contentRect: .zero,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        w.contentView = content
        w.level = .floating
        w.isOpaque = false
        w.backgroundColor = .clear
        w.hasShadow = false
        w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        w.isMovableByWindowBackground = true

        // Size to content
        let size = content.fittingSize
        w.setContentSize(size)

        // Pin to top-centre of main screen
        if let screen = NSScreen.main {
            let sx = screen.visibleFrame.midX - size.width / 2
            let sy = screen.visibleFrame.maxY - size.height - 8
            w.setFrameOrigin(NSPoint(x: sx, y: sy))
        }

        w.orderFrontRegardless()
        window = w
    }

    func close() {
        window?.close()
        window = nil
    }
}
