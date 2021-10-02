# sftp-upload

GitHub Action to upload files to an SFTP server.

**Warning**: This Action is designed for use in
[quick-lint's infrastructure](https://github.com/quick-lint)
only. No stability is guaranteed or implied. Use at your own
risk.

## Manual testing

You can test locally from a Linux machine by running the
following command from your Bash or Zsh shell:

```bash
env \
    INPUT_HOST=c.quick-lint-js.com \
    INPUT_LOCAL-FILE-GLOBS=README.md \
    INPUT_PRIVATE-KEY="$(cat ~/.ssh/id_rsa)" \
    INPUT_REMOTE-DIRECTORY=/var/www/c.quick-lint-js.com/sftp-upload-test/ \
    INPUT_USER=github-ci \
    node index.js
```
