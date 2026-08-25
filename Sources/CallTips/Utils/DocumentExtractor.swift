import Foundation
import PDFKit

enum DocumentExtractor {

    // MARK: – URL fetch

    static func fetchURL(_ urlString: String) async -> String? {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed) else { return nil }

        // hh.ru vacancy — use clean API instead of scraping
        if let result = await fetchHHVacancy(url: url) { return result }

        // Generic HTML fetch
        var req = URLRequest(url: url)
        req.setValue(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            forHTTPHeaderField: "User-Agent"
        )
        req.setValue("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", forHTTPHeaderField: "Accept")
        req.setValue("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7", forHTTPHeaderField: "Accept-Language")
        req.timeoutInterval = 10
        guard let (data, _) = try? await URLSession.shared.data(for: req) else { return nil }
        let html = String(data: data, encoding: .utf8)
               ?? String(data: data, encoding: .windowsCP1251)
               ?? ""
        return stripHTML(html)
    }

    // MARK: – HH.ru public API

    private static func fetchHHVacancy(url: URL) async -> String? {
        guard let host = url.host,
              (host == "hh.ru" || host.hasSuffix(".hh.ru")),
              url.pathComponents.count >= 3,
              url.pathComponents[1] == "vacancy" else { return nil }

        let vacancyId = url.pathComponents[2]
        guard !vacancyId.isEmpty, vacancyId.allSatisfy({ $0.isNumber }),
              let apiURL = URL(string: "https://api.hh.ru/vacancies/\(vacancyId)") else { return nil }

        var req = URLRequest(url: apiURL)
        req.setValue("call-tips/1.0", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 10

        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["name"] != nil else { return nil }

        var lines: [String] = []

        if let name = json["name"] as? String { lines.append("Вакансия: \(name)") }
        if let emp = (json["employer"] as? [String: Any])?["name"] as? String { lines.append("Компания: \(emp)") }
        if let area = (json["area"] as? [String: Any])?["name"] as? String { lines.append("Город: \(area)") }

        if let sal = json["salary"] as? [String: Any] {
            var s = "Зарплата:"
            if let v = sal["from"] as? Int { s += " от \(v)" }
            if let v = sal["to"]   as? Int { s += " до \(v)" }
            if let c = sal["currency"] as? String { s += " \(c)" }
            lines.append(s)
        }

        if let v = (json["experience"]  as? [String: Any])?["name"] as? String { lines.append("Опыт: \(v)") }
        if let v = (json["employment"]  as? [String: Any])?["name"] as? String { lines.append("Занятость: \(v)") }
        if let v = (json["schedule"]    as? [String: Any])?["name"] as? String { lines.append("График: \(v)") }

        if let desc = json["description"] as? String {
            lines.append("")
            lines.append(stripHTML(desc))
        }

        if let skills = json["key_skills"] as? [[String: Any]] {
            let names = skills.compactMap { $0["name"] as? String }
            if !names.isEmpty { lines.append("Ключевые навыки: " + names.joined(separator: ", ")) }
        }

        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

    private static func stripHTML(_ html: String) -> String {
        var s = html
        // Remove <script> and <style> blocks
        s = s.replacingOccurrences(of: "<script[^>]*>[\\s\\S]*?</script>", with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: "<style[^>]*>[\\s\\S]*?</style>", with: " ", options: .regularExpression)
        // Block tags → newline
        s = s.replacingOccurrences(of: "</(p|div|li|h[1-6]|br|tr)>", with: "\n", options: .regularExpression)
        // Strip remaining tags
        s = s.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        // HTML entities
        s = s.replacingOccurrences(of: "&nbsp;", with: " ")
        s = s.replacingOccurrences(of: "&amp;", with: "&")
        s = s.replacingOccurrences(of: "&lt;", with: "<")
        s = s.replacingOccurrences(of: "&gt;", with: ">")
        s = s.replacingOccurrences(of: "&quot;", with: "\"")
        s = s.replacingOccurrences(of: "&#?[a-zA-Z0-9]+;", with: " ", options: .regularExpression)
        // Collapse whitespace per line, drop empty lines
        let lines = s.components(separatedBy: "\n")
            .map { $0.replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return lines.joined(separator: "\n")
    }

    // MARK: – File extraction

    static func extract(from url: URL) -> String? {
        switch url.pathExtension.lowercased() {
        case "pdf":
            return extractPDF(url: url)
        case "docx":
            return extractDOCX(url: url)
        case "txt", "md", "markdown":
            return try? String(contentsOf: url, encoding: .utf8)
        default:
            return nil
        }
    }

    private static func extractPDF(url: URL) -> String? {
        PDFDocument(url: url)?.string
    }

    private static func extractDOCX(url: URL) -> String? {
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        proc.arguments = ["-p", url.path, "word/document.xml"]
        let out = Pipe()
        proc.standardOutput = out
        proc.standardError = Pipe()
        try? proc.run()
        proc.waitUntilExit()
        let data = out.fileHandleForReading.readDataToEndOfFile()
        guard let xml = String(data: data, encoding: .utf8) else { return nil }
        // Strip XML tags, collapse whitespace
        return xml
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
