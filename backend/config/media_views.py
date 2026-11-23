from django.core.exceptions import SuspiciousFileOperation
import mimetypes
import os
import re

from django.conf import settings
from django.http import StreamingHttpResponse, HttpResponse, HttpResponseNotFound
from django.utils._os import safe_join


def serve_media(request, path):
    try:
        file_path = safe_join(settings.MEDIA_ROOT, path)
    except (ValueError, TypeError, SuspiciousFileOperation):
        return HttpResponseNotFound()

    if not os.path.isfile(file_path):
        return HttpResponseNotFound()

    file_size = os.path.getsize(file_path)

    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"

    range_header = request.headers.get("Range")

    # No Range header: return the complete file.
    if not range_header:
        response = StreamingHttpResponse(
            file_iterator(file_path, 0, file_size - 1),
            content_type=content_type,
        )
        response["Content-Length"] = str(file_size)
        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = "inline"
        return response

    # Support a single byte range.
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())

    if not match:
        return range_not_satisfiable(file_size)

    start_text, end_text = match.groups()

    if not start_text and not end_text:
        return range_not_satisfiable(file_size)

    if not start_text:
        suffix_length = int(end_text)

        if suffix_length <= 0:
            return range_not_satisfiable(file_size)

        start = max(0, file_size - suffix_length)
        end = file_size - 1
    else:
        start = int(start_text)
        end = int(end_text) if end_text else file_size - 1

    if start >= file_size or start > end:
        return range_not_satisfiable(file_size)

    end = min(end, file_size - 1)
    content_length = end - start + 1

    if request.method == "HEAD":
        response = HttpResponse(status=206, content_type=content_type)
    else:
        response = StreamingHttpResponse(
            file_iterator(file_path, start, end),
            status=206,
            content_type=content_type,
        )

    response["Content-Length"] = str(content_length)
    response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    response["Accept-Ranges"] = "bytes"
    response["Content-Disposition"] = "inline"

    return response


def file_iterator(file_path, start, end, chunk_size=1024 * 1024):
    with open(file_path, "rb") as file:
        file.seek(start)
        remaining = end - start + 1

        while remaining > 0:
            chunk = file.read(min(chunk_size, remaining))

            if not chunk:
                break

            remaining -= len(chunk)
            yield chunk

def range_not_satisfiable(file_size):
    response = HttpResponse(status=416)
    response["Content-Range"] = f"bytes */{file_size}"
    response["Accept-Ranges"] = "bytes"
    return response