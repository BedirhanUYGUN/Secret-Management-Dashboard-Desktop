from alembic import command
from alembic.config import Config


def run() -> None:
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    run()
