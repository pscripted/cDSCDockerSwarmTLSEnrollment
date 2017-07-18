FROM stefanscherer/node-windows:8.1.4-nano-onbuild

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

CMD node .\app.js