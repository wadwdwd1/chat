const ADMIN_PASSWORD = "supersecret"; // change this!
let loggedIn = false;

function login() {
  const pw = document.getElementById('adminPassword').value;
  if (pw === ADMIN_PASSWORD) {
    loggedIn = true;
    document.getElementById('adminControls').style.display = "block";
    fetchMessages();
  } else {
    alert("Incorrect password!");
  }
}

function fetchMessages() {
  if (!loggedIn) return;

  const channel = document.getElementById('channelSelectAdmin').value;
  fetch(`/messages/${channel}`)
    .then(res => res.json())
    .then(data => {
      const adminBox = document.getElementById('adminMessages');
      adminBox.innerHTML = data.map((m, i) => {
        const localTime = new Date(m.time).toLocaleString();
        const imgHTML = m.image ? `<br><img src="${m.image}" style="max-width:200px;">` : '';
        return `<div style="border-bottom:1px solid #ccc; margin-bottom:5px; padding:5px;">
                  <b>${m.username}</b> [${localTime}] - IP: ${m.ip}<br>
                  ${m.message}${imgHTML}<br>
                  <button onclick="deleteMessage('${channel}', ${i})">Delete</button>
                </div>`;
      }).join('');
    });
}

function deleteMessage(channel, index) {
  if (!confirm("Are you sure you want to delete this message?")) return;

  fetch(`/deleteMessage/${channel}/${index}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(res => {
      if (res.success) fetchMessages();
      else alert("Failed to delete message.");
    });
}
