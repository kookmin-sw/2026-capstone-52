def success_response(data=None, message="요청이 성공했습니다."):
    return {
        "success": True,
        "data": data,
        "message": message
    }


def error_response(message="요청이 실패했습니다.", data=None):
    return {
        "success": False,
        "data": data,
        "message": message
    }
