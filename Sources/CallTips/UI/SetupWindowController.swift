import AppKit
import SwiftUI

@MainActor
final class SetupWindowController: NSObject, NSWindowDelegate {
    private var panel: NSPanel?

    func toggle(session: CallSession, apiKey: String, onStart: @escaping () -> Void) {
        if let p = panel {
            p.isVisible ? p.orderOut(nil) : p.orderFrontRegardless()
            return
        }
        build(session: session, apiKey: apiKey, onStart: onStart)
    }

    func show()  { panel?.orderFrontRegardless() }
    func hide()  { panel?.orderOut(nil) }

    private func build(session: CallSession, apiKey: String, onStart: @escaping () -> Void) {
        let root = RecruiterSetupView(session: session, apiKey: apiKey, onStart: onStart)
        let hosting = NSHostingView(rootView: root)

        let p = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 100),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        p.contentView = hosting
        p.delegate = self
        p.level = .floating
        p.isOpaque = false
        p.backgroundColor = NSColor.windowBackgroundColor
        p.hasShadow = true
        p.hidesOnDeactivate = false
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        p.isMovableByWindowBackground = true

        let sz = hosting.fittingSize
        p.setContentSize(sz)

        if let screen = NSScreen.main {
            let x = screen.visibleFrame.maxX - sz.width - 20
            let y = screen.visibleFrame.maxY - sz.height - 8
            p.setFrameOrigin(NSPoint(x: x, y: y))
        }

        p.makeKeyAndOrderFront(nil)
        panel = p
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }
}
