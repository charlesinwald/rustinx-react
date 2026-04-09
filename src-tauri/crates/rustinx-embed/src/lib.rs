//! Embedded `dist/` assets and Actix handler for SPA serving.
//! The folder is resolved from this crate's manifest to the repo root `dist/`.

use actix_web::middleware::DefaultHeaders;
use actix_web::{http::header, HttpRequest, HttpResponse, Responder};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../../dist/"]
struct EmbeddedDist;

/// Middleware adding a strict Content-Security-Policy to all responses.
pub fn default_security_headers() -> DefaultHeaders {
    DefaultHeaders::new().add((header::CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY))
}

/// Baseline CSP for the bundled UI (tune if the frontend adds external resources).
pub const CONTENT_SECURITY_POLICY: &str = concat!(
    "default-src 'self'; ",
    "script-src 'self'; ",
    "style-src 'self' 'unsafe-inline'; ",
    "img-src 'self' data: blob:; ",
    "font-src 'self' data:; ",
    "connect-src 'self'; ",
    "frame-ancestors 'none'; ",
    "base-uri 'self'; ",
    "form-action 'self'",
);

fn not_found() -> HttpResponse {
    HttpResponse::NotFound()
        .append_header((header::CONTENT_TYPE, "text/plain; charset=utf-8"))
        .body("Not Found")
}

/// Serve embedded static files; unknown paths fall back to `index.html` for SPA routing.
pub async fn serve_embedded_dist(req: HttpRequest) -> impl Responder {
    let path = req.path();
    let trimmed = path.trim_start_matches('/').trim_end_matches('/');
    if trimmed.contains("..") {
        return HttpResponse::Forbidden().body("Forbidden");
    }

    let file_key = if trimmed.is_empty() {
        "index.html"
    } else {
        trimmed
    };

    let try_file = |key: &str| -> Option<HttpResponse> {
        EmbeddedDist::get(key).map(|file| {
            let mime = mime_guess::from_path(key)
                .first_or_octet_stream()
                .essence_str()
                .to_string();
            let body: Vec<u8> = file.data.into_owned();
            HttpResponse::Ok()
                .append_header((header::CONTENT_TYPE, mime))
                .body(body)
        })
    };

    if let Some(resp) = try_file(file_key) {
        return resp;
    }

    if file_key != "index.html" {
        if let Some(resp) = try_file("index.html") {
            return resp;
        }
    }

    not_found()
}
