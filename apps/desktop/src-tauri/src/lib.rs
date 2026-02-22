use keyring::{Entry, Error as KeyringError};
use serde::Serialize;

const TOKEN_SERVICE: &str = "com.bedou.secretdashboard.auth";
const ACCESS_TOKEN_ACCOUNT: &str = "access_token";
const REFRESH_TOKEN_ACCOUNT: &str = "refresh_token";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthTokensPayload {
    access_token: Option<String>,
    refresh_token: Option<String>,
}

fn token_entry(account: &str) -> Result<Entry, String> {
    Entry::new(TOKEN_SERVICE, account).map_err(|error| error.to_string())
}

fn read_token(account: &str) -> Result<Option<String>, String> {
    let entry = token_entry(account)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_token(account: &str, value: &str) -> Result<(), String> {
    let entry = token_entry(account)?;
    entry.set_password(value).map_err(|error| error.to_string())
}

fn clear_token(account: &str) -> Result<(), String> {
    let entry = token_entry(account)?;
    match entry.delete_credential() {
        Ok(_) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_auth_tokens(access_token: String, refresh_token: String) -> Result<(), String> {
    write_token(ACCESS_TOKEN_ACCOUNT, &access_token)?;
    write_token(REFRESH_TOKEN_ACCOUNT, &refresh_token)?;
    Ok(())
}

#[tauri::command]
fn read_auth_tokens() -> Result<AuthTokensPayload, String> {
    Ok(AuthTokensPayload {
        access_token: read_token(ACCESS_TOKEN_ACCOUNT)?,
        refresh_token: read_token(REFRESH_TOKEN_ACCOUNT)?,
    })
}

#[tauri::command]
fn clear_auth_tokens() -> Result<(), String> {
    clear_token(ACCESS_TOKEN_ACCOUNT)?;
    clear_token(REFRESH_TOKEN_ACCOUNT)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_auth_tokens,
            read_auth_tokens,
            clear_auth_tokens
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
