from pydantic import BaseModel

from . import manager


class Request(BaseModel):
    path: str


class Response(BaseModel):
    pass


Manager = manager.Manager[Request, Response]


def run_job(request: Request) -> Response:
    return Response()
