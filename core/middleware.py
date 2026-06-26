import json
import logging
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

class StandardizeResponseASGIMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Only standardize path starting with /api, and skip video/file streaming endpoints
        if not path.startswith("/api") or path.startswith("/api/video"):
            await self.app(scope, receive, send)
            return

        response_status = 200
        response_headers = []
        is_json = False
        response_body = b""

        async def send_wrapper(message):
            nonlocal response_status, response_headers, is_json, response_body
            if message["type"] == "http.response.start":
                response_status = message["status"]
                response_headers = message.get("headers", [])
                
                # Check Content-Type header
                for name, value in response_headers:
                    if name.lower() == b"content-type" and b"application/json" in value:
                        is_json = True
                        break
                
                # If not application/json, pass it through directly
                if not is_json:
                    await send(message)
                    
            elif message["type"] == "http.response.body":
                if is_json:
                    # Accumulate chunk
                    response_body += message.get("body", b"")
                    # If there's more body chunks coming, wait
                    if message.get("more_body", False):
                        return
                    
                    # Complete body received, decode and wrap it
                    try:
                        data = json.loads(response_body.decode("utf-8"))
                    except Exception:
                        data = response_body.decode("utf-8")
                    
                    # Avoid double wrapping: if it is already wrapped in the standard format
                    if isinstance(data, dict) and "code" in data and "message" in data and "data" in data:
                        wrapped_data = data
                    else:
                        message_str = "Success"
                        # Handle message mappings
                        if isinstance(data, dict):
                            if "message" in data:
                                message_str = data.pop("message")
                            elif "msg" in data:
                                message_str = data.pop("msg")
                            elif "detail" in data:
                                if isinstance(data["detail"], str):
                                    message_str = data.pop("detail")
                                    data = []
                                elif isinstance(data["detail"], list):
                                    # Typical FastAPI validation error
                                    message_str = "Validation Error"
                                    data = data.pop("detail")
                        elif response_status >= 400:
                            message_str = "Error"
                        
                        wrapped_data = {
                            "code": response_status,
                            "message": message_str,
                            "data": data
                        }
                    
                    new_body = json.dumps(wrapped_data, ensure_ascii=False).encode("utf-8")
                    
                    # Adjust content-length header
                    new_headers = []
                    for name, value in response_headers:
                        if name.lower() == b"content-length":
                            continue
                        new_headers.append((name, value))
                    new_headers.append((b"content-length", str(len(new_body)).encode("ascii")))
                    
                    # Send response start and body
                    await send({
                        "type": "http.response.start",
                        "status": response_status,
                        "headers": new_headers
                    })
                    await send({
                        "type": "http.response.body",
                        "body": new_body,
                        "more_body": False
                    })
                else:
                    await send(message)
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)

def register_standardized_responses(app: FastAPI):
    """
    Registers StandardizeResponseASGIMiddleware and custom exception handlers
    on the FastAPI application instance.
    """
    # 1. Register ASGI Middleware
    app.add_middleware(StandardizeResponseASGIMiddleware)

    # 2. Register Custom Exception Handlers
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.status_code,
                "message": str(exc.detail),
                "data": []
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        errors = exc.errors()
        # Build a friendly string from the first validation error if possible
        if errors:
            first_err = errors[0]
            loc = " -> ".join(str(x) for x in first_err.get("loc", []))
            msg = f"Validation Error: [{loc}] {first_err.get('msg', '')}"
        else:
            msg = "Validation Error"
        
        return JSONResponse(
            status_code=422,
            content={
                "code": 422,
                "message": msg,
                "data": errors
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger.exception("Unhandled server error")
        return JSONResponse(
            status_code=500,
            content={
                "code": 500,
                "message": "Internal Server Error",
                "data": str(exc)
            }
        )
