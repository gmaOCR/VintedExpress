Release package and upload instructions

1) Build (already done):
   npm run build

2) Generate release zip (already created at release/vintedexpress-v0.1.0.zip)

3) Verify zip contents (must include manifest.json and built JS/CSS under dist/ or top-level files):
   unzip -l release/vintedexpress-v0.1.0.zip

4) Upload to Chrome Web Store developer dashboard:
   - Ensure you have a developer account and have paid the listing fee
   - Create a new item and upload the zip
   - Fill app details: title, short description, long description
   - Provide support email and Privacy Policy URL
   - Add screenshots and icons (128x128 recommended)

5) Key management:
   - Keep your production signing key (release-key.pem) secure and OUTSIDE the repo
   - Do not commit it. Store it in a secrets manager (GitHub secrets, Vault, etc.)

6) CI / Publishing:
   - Optionally automate uploads with GitHub Actions using secrets. Avoid storing private keys in repo.

7) Post-publish:
   - Monitor reviews and errors, respond to privacy or policy issues.

Notes:
- We removed/ignored .pem files to avoid leaks.
- If the previously-committed key was exposed, treat it as compromised and rotate keys if necessary.
