WSL2 Kali Setup

Download the Linux kernel update package

The Linux kernel update package installs the most recent version of the WSL 2 Linux kernel for running WSL inside the Windows operating system image. (To run WSL from the Microsoft Store, with more frequently pushed updates, use wsl.exe --install or wsl.exe --update.).

    Download the latest package:
        WSL2 Linux kernel update package for x64 machines
https://learn.microsoft.com/en-us/windows/wsl/install-manual#step-4---download-the-linux-kernel-update-package

updates, use wsl.exe --install or wsl.exe --update 

wsl --set-default-version 2
Download from Desktop Microsoft App Store
Windows Subsystem for Linux

Download from Desktop Microsoft App Store
Kali Linux #Or any Linux Distro of your choosing

    NOTE: If there is an existing Kali WSL 1, upgrade it by running: wsl --set-version kali-linux 2

Docker – Settings – Resources – WSL Intergration – Check WSL Distro

**Update Kali**:
apt-get update
apt-get dist-upgrade
sudo apt full-upgrade -y

Useful Kali tools:
https://www.kali.org/docs/general-use/metapackages/

Launch Kali in terminal: kali

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/yarn-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/yarn-archive-keyring.gpg] https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list > /dev/null

sudo apt update

sudo apt install git
sudo apt update
sudo apt install python3-pip
sudo apt update



PolyGPT
git clone https://github.com/polywrap/PolyGPT.git

Copy the .env.template file and rename it to .env
cp .env.template .env
Find the line that says OPENAI_API_KEY=, and add your unique OpenAI API Key
OPENAI_API_KEY=sk-...

Use the correct version of Node.JS
nvm install && nvm use

Dependencies for PolyGPT:
Install NVM (Node Version Manager):

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install node

Install required dependencies:
sudo apt update
sudo apt install -y gnupg

Install Yarn:
First, add the Yarn repository:

sudo curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo tee /tmp/yarn-pubkey.gpg > /dev/null && sudo gpg --dearmor -o /usr/share/keyrings/yarn-archive-keyring.gpg /tmp/yarn-pubkey.gpg

echo "deb [signed-by=/usr/share/keyrings/yarn-archive-keyring.gpg] https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list > /dev/null

Then update and install Yarn:
sudo apt update
sudo apt install yarn
sudo apt update

Install Yarn packages:
Navigate to the project directory where the package.json is located and then:
yarn install

Start Yarn (if applicable):
yarn start