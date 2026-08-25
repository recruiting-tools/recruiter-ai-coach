import AppKit
import SwiftUI

@MainActor
final class SetupWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?

    func toggle(session: CallSession, apiKey: String, onStart: @escaping () -> Void) {
        if let w = window {
            if w.isVisible { w.orderOut(nil) } else { activate(w) }
            return
        }
        build(session: session, apiKey: apiKey, onStart: onStart)
    }

    func show() { if let w = window { activate(w) } }
    func hide() {
        window?.orderOut(nil)
        NSApp.setActivationPolicy(.accessory)
    }

    private func activate(_ w: NSWindow) {
        NSApp.setActivationPolicy(.regular)
        w.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func build(session: CallSession, apiKey: String, onStart: @escaping () -> Void) {
        let root = RecruiterSetupView(session: session, apiKey: apiKey, onStart: onStart)
        let hosting = NSHostingView(rootView: root)

        let w = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 100),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        w.contentView = hosting
        w.delegate = self
        w.title = "Call Tips"
        w.titlebarAppearsTransparent = true
        w.titleVisibility = .hidden
        w.isMovableByWindowBackground = true
        w.level = .floating
        w.hidesOnDeactivate = false
        w.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let sz = hosting.fittingSize
        w.setContentSize(sz)

        if let screen = NSScreen.main {
            let x = screen.visibleFrame.maxX - sz.width - 20
            let y = screen.visibleFrame.maxY - sz.height - 8
            w.setFrameOrigin(NSPoint(x: x, y: y))
        }

        activate(w)
        window = w
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }
}
