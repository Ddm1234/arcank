const connectButton = document.getElementById("connectButton");
const sendButton = document.getElementById("sendButton");
const walletStatus = document.getElementById("walletStatus");
const message = document.getElementById("message");

let walletAddress = null;

connectButton.addEventListener("click", async () => {
  if (!window.ethereum) {
    message.textContent = "No compatible wallet found.";
    return;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    walletAddress = accounts[0];

    walletStatus.textContent =
      "Connected: " +
      walletAddress.slice(0, 6) +
      "..." +
      walletAddress.slice(-4);

    connectButton.textContent = "Wallet Connected";
    sendButton.disabled = false;
    message.textContent = "";
  } catch (error) {
    message.textContent = "Wallet connection cancelled.";
  }
});
