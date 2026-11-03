from celery import shared_task

@shared_task
def test_celery_task():
    print("Celery background task executed successfully!")
    return "Celery is working!"
