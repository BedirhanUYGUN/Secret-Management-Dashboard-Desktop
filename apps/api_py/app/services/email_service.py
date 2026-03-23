import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailSendError(Exception):
    """Raised when email sending fails."""


def _build_reset_email_html(reset_link: str, expire_minutes: int) -> str:
    return (
        f"<p>Merhaba,</p>"
        f"<p>Sifrenizi sifirlamak icin asagidaki baglantiyi kullanin:</p>"
        f'<p><a href="{reset_link}">{reset_link}</a></p>'
        f"<p>Bu baglanti {expire_minutes} dakika gecerlidir.</p>"
        f"<p>Bu istegi siz yapmadiysiniz, bu e-postayi gormezden gelebilirsiniz.</p>"
    )


def _send_via_resend(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        raise EmailSendError("RESEND_API_KEY yapilandirilmamis.")

    from_email = settings.SMTP_FROM_EMAIL or "noreply@example.com"

    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.exception("Resend API baglanti hatasi: %s", to)
        raise EmailSendError(f"Resend API baglanti hatasi: {exc}") from exc

    if response.status_code not in (200, 201):
        logger.error("Resend API hata %s: %s", response.status_code, response.text)
        raise EmailSendError(f"Resend API hata: {response.status_code}")


def _send_via_smtp(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    if not settings.SMTP_HOST:
        raise EmailSendError("SMTP_HOST yapilandirilmamis.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], [to], msg.as_string())
        server.quit()
    except Exception as exc:
        logger.exception("SMTP gonderim hatasi: %s", to)
        raise EmailSendError(f"SMTP hatasi: {exc}") from exc


def send_email(to: str, subject: str, html: str) -> None:
    """Send an email using the configured provider. Raises EmailSendError on failure."""
    settings = get_settings()

    if settings.RESEND_API_KEY:
        _send_via_resend(to, subject, html)
    elif settings.SMTP_HOST:
        _send_via_smtp(to, subject, html)
    else:
        raise EmailSendError(
            "E-posta gonderimi yapilandirilmamis. "
            "RESEND_API_KEY veya SMTP_HOST ayarlayin."
        )

    logger.info("E-posta gonderildi: %s", to)


def send_password_reset_email(email: str, reset_token: str) -> None:
    """Send password reset email. Raises EmailSendError if sending fails."""
    settings = get_settings()
    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={reset_token}"
    subject = "Sifre Sifirlama Talebi"
    html = _build_reset_email_html(reset_link, settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    send_email(email, subject, html)
