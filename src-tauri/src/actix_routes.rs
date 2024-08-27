use actix_web::{web, HttpResponse, Responder};

// Example route for Actix
pub(crate) async fn example_route() -> impl Responder {
    HttpResponse::Ok().body("This is an example route")
}

// Another example route that takes a path parameter
pub(crate) async fn greet(name: web::Path<String>) -> impl Responder {
    HttpResponse::Ok().body(format!("Hello, {}!", name))
}

// Function to configure all routes
pub(crate) fn configure(cfg: &mut web::ServiceConfig) {
    cfg
        .route("/example", web::get().to(example_route))
        .route("/greet/{name}", web::get().to(greet));
}
