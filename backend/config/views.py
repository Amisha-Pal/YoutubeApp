from django.http import JsonResponse

def home(request):
    return JsonResponse({
        "message": "Welcome to YouTube Backend API!",
        "status": "Running",
        "service": "YouTube Backend",
        "version": "1.0"
    })