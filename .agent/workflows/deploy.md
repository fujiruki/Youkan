---
description: Deploy the application to the production server (ConoHa) using the standardized upload script.
---

This workflow automates the deployment process by executing the `upload.ps1` script provided in the `docs/AI_DEVELOP_RULES/UPLOAD` directory.

The script performs the following steps:
1. Builds the frontend (`npm run build`).
2. Packages the frontend assets and backend files.
3. Uploads the package to the server via SCP.
4. Extracts and sets permissions on the server via SSH.

# Steps

1. **Verify Prerequisites**
   Ensure that the `docs/AI_DEVELOP_RULES/UPLOAD` directory exists and contains `upload.ps1` and the SSH key.

2. **Execute Deployment Script**
   Run the following command from the project root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\docs\01_RULES\UPLOAD\upload.ps1
   ```
   
   > **Note**: The script is configured to deploy to `public_html/door-fujita.com/contents/TateguDesignStudio`.
