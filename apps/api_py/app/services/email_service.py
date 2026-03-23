import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_password_reset_email(email: str, reset_token: str) -> None:
    settings = get_settings()
    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={reset_token}"

    if not settings.SMTP_HOST:
        logger.info(
            "SMTP yapilandirilmamis. Sifre sifirlama linki (dev): %s", reset_link
        )
        return

    subject = "Sifre Sifirlama Talebi"
    body_html = (
        f"<p>Merhaba,</p>"
        f"<p>Sifrenizi sifirlamak icin asagidaki baglantiyi kullanin:</p>"
        f'<p><a href="{reset_link}">{reset_link}</a></p>'
        f"<p>Bu baglanti {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} dakika gecerlidir.</p>"
        f"<p>Bu istegi siz yapmadiysiniz, bu e-postayi gormezden gelebilirsiniz.</p>"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["To"] = email
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)

        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(msg["From"], [email], msg.as_string())
        server.quit()
        logger.info("Sifre sifirlama e-postasi gonderildi: %s", email)
    except Exception:
        logger.exception("Sifre sifirlama e-postasi gonderilemedi: %s", email)
