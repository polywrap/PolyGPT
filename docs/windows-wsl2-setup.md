# Windows WSL2 Setup

The Linux kernel update package installs the most recent version of the WSL 2 Linux kernel for running WSL inside the Windows operating system image. (To run WSL from the Microsoft Store, with more frequently pushed updates, use `wsl.exe --install or wsl.exe --update`).

* Download the latest WSL2 Linux kernel package for x64 machines:  
https://learn.microsoft.com/en-us/windows/wsl/install-manual#step-4---download-the-linux-kernel-update-package

* Install updates:  
`wsl.exe --install` or `wsl.exe --update`

* Set the default version to 2:  
`wsl --set-default-version 2`

* Now, download Kali Linux or any distro of your choosing.

> NOTE: If there is an existing Kali WSL 1, upgrade it by running:  
`wsl --set-version kali-linux 2`


## Update Kali
```
apt-get update
apt-get dist-upgrade
sudo apt full-upgrade -y
```

Useful Kali tools:  
https://www.kali.org/docs/general-use/metapackages/

Launch Kali in terminal:  
`kali`

## Follow: "Getting Started"

Follow the "Getting Started" steps detailed in the root [README](../README.md).
