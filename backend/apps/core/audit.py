from .models import AuditLog


def client_ip(request):
    if request is None:
        return None
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")) or None


def log_action(request, action, entity, summary="", metadata=None, actor=None):
    """Record a sensitive action. `entity` is a model instance or (type, id) tuple."""
    if isinstance(entity, tuple):
        etype, eid = entity
    else:
        etype, eid = entity.__class__.__name__, entity.pk
    user = actor or (getattr(request, "user", None) if request else None)
    if user is not None and not getattr(user, "is_authenticated", False):
        user = None
    return AuditLog.objects.create(
        actor=user, action=action, entity_type=etype, entity_id=str(eid),
        summary=summary[:255], metadata=metadata or {}, ip_address=client_ip(request),
    )
