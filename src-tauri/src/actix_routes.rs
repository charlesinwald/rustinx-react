use actix_session::Session;
use actix_web::{web, HttpResponse, Error};

async fn check_session(session: Session) -> Result<HttpResponse, Error> {
    if let Some(logged_in) = session.get::<bool>("logged_in")? {
        if logged_in {
            return Ok(HttpResponse::Ok().finish());
        }
    }
    Ok(HttpResponse::Unauthorized().finish())
}

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.route("/session", web::get().to(check_session));
}