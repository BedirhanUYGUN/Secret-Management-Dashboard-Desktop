import uvicorn


def run() -> None:
    uvicorn.run("app.main:app", host="0.0.0.0", port=4000, reload=True)


if __name__ == "__main__":
    run()
