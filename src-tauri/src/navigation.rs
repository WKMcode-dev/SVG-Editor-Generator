use tauri::Url;

pub fn allowed(url: &Url, dev_url: Option<&Url>) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let bundled = url.port().is_none()
        && matches!(
            (url.scheme(), url.host_str()),
            ("tauri", Some("localhost"))
                | ("http", Some("tauri.localhost"))
                | ("https", Some("tauri.localhost"))
        );
    // Match scheme, host and effective port, not a hostname substring.
    let configured_dev = dev_url
        .filter(|dev| matches!(dev.scheme(), "http" | "https"))
        .is_some_and(|dev| dev.origin() == url.origin());
    bundled || configured_dev
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn built_in_dev_server_is_allowed_at_its_configured_origin() {
        for origin in ["http://127.0.0.1:1430", "http://localhost:1431", "http://[::1]:1430"] {
            let dev = Url::parse(origin).unwrap();
            let page = Url::parse(&format!("{origin}/index.html?test=1#editor")).unwrap();
            assert!(allowed(&page, Some(&dev)));
            assert!(!allowed(&page, None));
        }
    }

    #[test]
    fn sites_other_ports_and_credentials_are_blocked() {
        let dev = Url::parse("http://127.0.0.1:1430").unwrap();
        for url in [
            "http://127.0.0.1:1431", "https://127.0.0.1:1430",
            "http://127.0.0.1.example.com:1430", "https://example.com",
            "http://user@127.0.0.1:1430", "http://tauri.localhost:8080",
            "http://user@tauri.localhost", "file:///C:/Windows/test.html",
        ] {
            assert!(!allowed(&Url::parse(url).unwrap(), Some(&dev)), "{url}");
        }
    }

    #[test]
    fn bundled_pages_remain_allowed_without_a_dev_server() {
        for origin in ["tauri://localhost/index.html", "http://tauri.localhost/", "https://tauri.localhost/"] {
            assert!(allowed(&Url::parse(origin).unwrap(), None));
        }
    }
}
