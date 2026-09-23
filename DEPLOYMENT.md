# AQSA-ERP / Royal Inventory - Windows Production Deployment Guide

This system packages the full-stack Royal Inventory application (React frontend + Node.js backend) into a single, portable, self-contained deployment folder (`deploy/`) that runs as a resilient Windows Service without requiring Node.js, Git, or build tools on the target server.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |   Client Browser (PC / Mobile / POS)  |
                      +---------------------------------------+
                                          |
                                          v  HTTP Port 7575
+---------------------------------------------------------------------------------+
| Windows Machine / Windows Server (Target Environment)                           |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   | Windows Service: AQSA-ERP (Managed via NSSM)                            |
|   |   - Auto-start on boot                                                  |
|   |   - Automatic crash recovery (5-second delay)                           |
|   |   - Working directory: deploy\app\                                      |
|   |   - Self-contained Runtime: deploy\runtime\node.exe                     |
|   +-------------------------------------------------------------------------+   |
|                                          |                                      |
|                                          v                                      |
|   +-------------------------------------------------------------------------+   |
|   | Node.js Server (Port 7575)                                              |
|   |                                                                         |
|   |   +------------------------+          +-----------------------------+   |
|   |   | API Routes (/api/v1/*) |          | Static Files & SPA (/*)     |   |
|   |   | Express API Controller |          | React Production Bundle     |   |
|   |   +------------------------+          +-----------------------------+   |
|   +-------------------------------------------------------------------------+   |
|                                          |                                      |
|                                          v                                      |
|   +-------------------------------------------------------------------------+   |
|   | Logs & Diagnostics: deploy\data\logs\                                   |
|   |   - service-stdout.log & service-stderr.log (Process output)            |
|   |   - combined-YYYY-MM-DD.log & error-YYYY-MM-DD.log (Winston logs)       |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
```

---

## 1. Development Machine: Packaging

To build and package the production deployment:

1. Open PowerShell or Command Prompt in the project root:
   ```cmd
   cd E:\royal-inventory
   ```
2. Run the packager:
   ```cmd
   update.bat
   ```

### What `update.bat` Does:
1. Validates that Node.js, npm, and NSSM are available on the development machine.
2. Stops any running `AQSA-ERP` service instance to unlock files.
3. Builds the production React bundle via Vite into `dist/`.
4. Initializes a clean `deploy/` directory.
5. Copies the portable Node.js executable into `deploy\runtime\node.exe`.
6. Copies the 64-bit service manager into `deploy\tools\nssm.exe`.
7. Copies the React build into `deploy\app\public\`.
8. Copies the Node backend source code into `deploy\app\src\`.
9. Copies database migrations and scripts into `deploy\app\migrations\` and `deploy\app\scripts\`.
10. Copies production runtime dependencies (`node_modules`) into `deploy\app\node_modules\`.
11. Generates runtime configuration (`deploy\app\.env`).
12. Performs a standalone smoke test using the packaged runtime before finishing.

---

## 2. Transfer to Target Machine

Copy **ONLY** the generated `deploy/` folder to the target Windows machine.

You can move it to any location, for example:
- `C:\AQSA-ERP\deploy`
- `D:\Programs\AQSA-ERP`
- `E:\royal-inventory-deploy`

> [!IMPORTANT]
> The target machine does **NOT** need:
> - Git
> - Node.js or npm installed
> - TypeScript compiler
> - React build tools
> - Source code repository
> - Internet connection (can be completely air-gapped)

---

## 3. Configuration (Target Machine)

Before starting the service on the target machine, inspect or edit:
```
deploy\app\.env
```

Key configuration variables:
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `7575` | The port the entire application listens on (API + React) |
| `SYSTEM_DB_SERVER` | `192.168.50.5` | Host / IP for SQL Server (InventoryOps) |
| `SYSTEM_DB_NAME` | `InventoryOps` | Primary operations database |
| `SYSTEM_DB_USER` | `sa` | SQL Server username |
| `SYSTEM_DB_PASSWORD`| - | SQL Server password |
| `COMSYS_DB_SERVER` | `192.168.50.1` | Host / IP for read-only Comsys DB |
| `LOG_DIR` | `../data/logs` | Destination for application logs |
| `CLIENT_BUILD_PATH`| `./public` | Relative path to React static build |

---

## 4. Database Migrations (Optional / Initial Setup)

If you need to apply pending database migrations on the target SQL Server:
1. Open Command Prompt in `deploy\`:
2. Run:
   ```cmd
   runtime\node.exe app\scripts\run_migrations.js
   ```

---

## 5. Service Installation

To install and run the application as a Windows Service:

1. Open the `deploy\` folder.
2. **Right-click `install-service.bat` and select "Run as administrator"**.
3. The script will:
   - Validate deployment integrity (`node.exe`, `nssm.exe`, `app\src\server.js`).
   - Register the Windows Service named `AQSA-ERP`.
   - Configure automatic startup with Windows (`SERVICE_AUTO_START`).
   - Configure automatic process restart if the server ever crashes (5s throttle).
   - Configure standard and error log redirection.
   - Start the service immediately.
   - Verify the service is in the `RUNNING` state.

### Accessing the Application:
Once installed, open any web browser:
```
http://localhost:7575
```
Or from another PC on the local network:
```
http://<SERVER_IP>:7575
```

---

## 6. Service Management & Maintenance

### Checking Service Status:
Open Windows Services manager (`services.msc`) and locate:
- **AQSA ERP - Royal Inventory System** (`AQSA-ERP`)

Or from Command Prompt:
```cmd
deploy\tools\nssm.exe status AQSA-ERP
```

### Viewing Logs:
All logs are stored in `deploy\data\logs\`:
- `service-stdout.log`: Console output from the application process.
- `service-stderr.log`: Process startup errors and unhandled exceptions.
- `combined-YYYY-MM-DD.log`: Full Winston application logs (HTTP requests, transactions).
- `error-YYYY-MM-DD.log`: Error-level application logs.

Logs are automatically rotated when they reach 10MB or daily.

### Updating the Application on the Target Machine:
1. Generate a new `deploy\` folder on the dev machine via `update.bat`.
2. Stop the service on the target machine:
   ```cmd
   deploy\tools\nssm.exe stop AQSA-ERP
   ```
3. Copy new files into `deploy\app\` (preserving `deploy\app\.env`).
4. Start the service:
   ```cmd
   deploy\tools\nssm.exe start AQSA-ERP
   ```
*(Or simply run `deploy\update.bat` which will automatically reload the service).*

---

## 7. Service Removal

To cleanly uninstall the Windows Service:

1. Open the `deploy\` folder.
2. **Right-click `uninstall-service.bat` and select "Run as administrator"**.
3. The service will be stopped and unregistered from Windows Service Manager.
4. **Your application files, databases, and logs are completely preserved.**
