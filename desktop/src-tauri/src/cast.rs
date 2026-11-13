//! DLNA / UPnP casting using only the standard library (no extra crates).
//! Finds TVs and speakers on the local network (SSDP) and tells them to play
//! a stream URL (AVTransport SOAP). Works on Linux, Windows and macOS.

use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs, UdpSocket};
use std::time::{Duration, Instant};

const AV_TRANSPORT: &str = "urn:schemas-upnp-org:service:AVTransport:1";

/// (friendly name, absolute AVTransport control URL)
pub type Device = (String, String);

struct Url {
    host: String,
    port: u16,
    path: String,
}

fn parse_url(url: &str) -> Result<Url, String> {
    let rest = url.strip_prefix("http://").ok_or("Only http:// device addresses are supported")?;
    let (authority, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, "/"),
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((h, p)) => (h.to_string(), p.parse::<u16>().map_err(|_| "Bad port")?),
        None => (authority.to_string(), 80),
    };
    Ok(Url { host, port, path: path.to_string() })
}

fn decode_chunked(mut body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let Some(nl) = body.windows(2).position(|w| w == b"\r\n") else { break };
        let size_str = String::from_utf8_lossy(&body[..nl]);
        let size = usize::from_str_radix(size_str.split(';').next().unwrap_or("").trim(), 16).unwrap_or(0);
        body = &body[nl + 2..];
        if size == 0 || body.len() < size {
            if size > 0 {
                out.extend_from_slice(body);
            }
            break;
        }
        out.extend_from_slice(&body[..size]);
        body = &body[size..];
        if body.len() >= 2 {
            body = &body[2..];
        }
    }
    out
}

fn http(method: &str, url: &str, extra: &[(&str, String)], body: &str) -> Result<String, String> {
    let u = parse_url(url)?;
    let addr = (u.host.as_str(), u.port)
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
        .next()
        .ok_or("Device address not found")?;
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_secs(4)).map_err(|e| e.to_string())?;
    s.set_read_timeout(Some(Duration::from_secs(6))).ok();
    s.set_write_timeout(Some(Duration::from_secs(6))).ok();
    let mut req = format!(
        "{method} {} HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\nUser-Agent: CineHub/1.0 UPnP/1.0\r\n",
        u.path, u.host, u.port
    );
    for (k, v) in extra {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str(&format!("Content-Length: {}\r\n\r\n{body}", body.len()));
    s.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    let _ = s.read_to_end(&mut raw);
    let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("Empty reply from device")?;
    let head = String::from_utf8_lossy(&raw[..split]).to_string();
    let status_ok = head.lines().next().map(|l| l.contains(" 200")).unwrap_or(false);
    let payload = &raw[split + 4..];
    let bytes = if head.to_ascii_lowercase().contains("transfer-encoding: chunked") { decode_chunked(payload) } else { payload.to_vec() };
    let text = String::from_utf8_lossy(&bytes).to_string();
    if !status_ok {
        return Err(tag(&text, "errorDescription").unwrap_or_else(|| head.lines().next().unwrap_or("Device refused the request").to_string()));
    }
    Ok(text)
}

fn tag(xml: &str, name: &str) -> Option<String> {
    let open = format!("<{name}>");
    let close = format!("</{name}>");
    let a = xml.find(&open)? + open.len();
    let b = xml[a..].find(&close)? + a;
    Some(xml[a..b].trim().to_string())
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&apos;")
}

fn header(resp: &str, name: &str) -> Option<String> {
    resp.lines().find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.trim().eq_ignore_ascii_case(name).then(|| v.trim().to_string())
    })
}

/// Reads the device description and returns (name, absolute control URL) when it can play media.
fn describe(location: &str) -> Option<Device> {
    let xml = http("GET", location, &[], "").ok()?;
    let name = tag(&xml, "friendlyName").unwrap_or_else(|| "TV".to_string());
    let at = xml.find(AV_TRANSPORT)?;
    let control = tag(&xml[at..], "controlURL")?;
    let base = parse_url(location).ok()?;
    let abs = if control.starts_with("http://") {
        control
    } else if control.starts_with('/') {
        format!("http://{}:{}{}", base.host, base.port, control)
    } else {
        let dir = base.path.rsplit_once('/').map(|x| x.0).unwrap_or("");
        format!("http://{}:{}{}/{}", base.host, base.port, dir, control)
    };
    Some((name, abs))
}

/// Looks for media renderers on the local network for about `secs` seconds.
pub fn discover(secs: u64) -> Result<Vec<Device>, String> {
    let sock = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_millis(400))).ok();
    let msg = format!(
        "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: {AV_TRANSPORT}\r\n\r\n"
    );
    for _ in 0..2 {
        let _ = sock.send_to(msg.as_bytes(), "239.255.255.250:1900");
    }
    let mut seen: HashSet<String> = HashSet::new();
    let mut locations: Vec<String> = Vec::new();
    let end = Instant::now() + Duration::from_secs(secs);
    let mut buf = [0u8; 2048];
    while Instant::now() < end {
        if let Ok((n, _)) = sock.recv_from(&mut buf) {
            let text = String::from_utf8_lossy(&buf[..n]).to_string();
            if let Some(loc) = header(&text, "location") {
                if seen.insert(loc.clone()) {
                    locations.push(loc);
                }
            }
        }
    }
    let mut devices: Vec<Device> = Vec::new();
    for loc in locations {
        if let Some(d) = describe(&loc) {
            if !devices.iter().any(|x| x.1 == d.1) {
                devices.push(d);
            }
        }
    }
    Ok(devices)
}

fn soap(control: &str, action: &str, args: &str) -> Result<String, String> {
    let body = format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:{action} xmlns:u=\"{AV_TRANSPORT}\"><InstanceID>0</InstanceID>{args}</u:{action}></s:Body></s:Envelope>"
    );
    http(
        "POST",
        control,
        &[
            ("Content-Type", "text/xml; charset=\"utf-8\"".to_string()),
            ("SOAPAction", format!("\"{AV_TRANSPORT}#{action}\"")),
        ],
        &body,
    )
}

fn didl(url: &str, title: &str) -> String {
    let class = if url.to_ascii_lowercase().contains(".mp3") { "object.item.audioItem.musicTrack" } else { "object.item.videoItem" };
    format!(
        "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\"><item id=\"0\" parentID=\"-1\" restricted=\"1\"><dc:title>{}</dc:title><upnp:class>{class}</upnp:class><res protocolInfo=\"http-get:*:video/mp4:*\">{}</res></item></DIDL-Lite>",
        escape(title),
        escape(url)
    )
}

pub fn play(control: &str, media_url: &str, title: &str) -> Result<(), String> {
    let _ = soap(control, "Stop", "");
    soap(
        control,
        "SetAVTransportURI",
        &format!(
            "<CurrentURI>{}</CurrentURI><CurrentURIMetaData>{}</CurrentURIMetaData>",
            escape(media_url),
            escape(&didl(media_url, title))
        ),
    )?;
    soap(control, "Play", "<Speed>1</Speed>")?;
    Ok(())
}

pub fn stop(control: &str) -> Result<(), String> {
    soap(control, "Stop", "").map(|_| ())
}

pub fn pause(control: &str) -> Result<(), String> {
    soap(control, "Pause", "").map(|_| ())
}

pub fn resume(control: &str) -> Result<(), String> {
    soap(control, "Play", "<Speed>1</Speed>").map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_urls() {
        let u = parse_url("http://192.168.1.5:49152/desc.xml").unwrap();
        assert_eq!((u.host.as_str(), u.port, u.path.as_str()), ("192.168.1.5", 49152, "/desc.xml"));
        assert_eq!(parse_url("http://tv.local").unwrap().port, 80);
        assert!(parse_url("https://x").is_err());
    }

    #[test]
    fn reads_tags_and_headers() {
        assert_eq!(tag("<a><friendlyName> Living Room </friendlyName></a>", "friendlyName").as_deref(), Some("Living Room"));
        assert_eq!(header("HTTP/1.1 200 OK\r\nLocation: http://x/d.xml\r\n", "LOCATION").as_deref(), Some("http://x/d.xml"));
    }

    #[test]
    fn decodes_chunks() {
        assert_eq!(decode_chunked(b"5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n"), b"hello world");
    }

    #[test]
    fn escapes_xml() {
        assert_eq!(escape("a&b<c>\"'"), "a&amp;b&lt;c&gt;&quot;&apos;");
    }
}
