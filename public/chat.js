let currentChannel='general';
const channelSelect=document.getElementById('channelSelect');
channelSelect.addEventListener('change',()=>{
    currentChannel=channelSelect.value;
    fetchMessages();
});

function fetchMessages(){
    fetch(`/messages/${currentChannel}`)
    .then(res=>res.json())
    .then(data=>{
        const chatBox=document.getElementById('chatBox');
        chatBox.innerHTML=data.map(m=>{
            const localTime=new Date(m.time).toLocaleString();
            let imgHTML=m.image?`<br><img src="${m.image}" style="max-width:200px;border-radius:5px;">`:'';
            let style=m.uncopyable?"user-select:none;color:red;":"";
            return `<p style="${style}"><b>${m.username}</b> [${localTime}]: ${m.message}${imgHTML}</p>`;
        }).join('');
        chatBox.scrollTop=chatBox.scrollHeight;
    });
}

function sendMessage(){
    const username=document.getElementById('username').value||'Anonymous';
    const message=document.getElementById('message').value;
    const imageInput=document.getElementById('imageInput');

    if(imageInput.files.length>0){
        const file=imageInput.files[0];
        const reader=new FileReader();
        reader.onload=function(){ sendToServer(username,message,reader.result); }
        reader.readAsDataURL(file);
    }else sendToServer(username,message,null);
}

function sendToServer(username,message,base64Image){
    if(currentChannel==='ai'){
        // Send to AI endpoint
        fetch('/ai',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({prompt:message})
        }).then(res=>res.json())
        .then(data=>{
            // Save user's message
            fetch(`/upload/${currentChannel}`,{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({username,message,image:base64Image})
            });

            // Save AI response if available
            if(data.answer){
                fetch(`/upload/${currentChannel}`,{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({username:'AI',message:data.answer})
                });
            }
            document.getElementById('message').value='';
            document.getElementById('imageInput').value='';
            fetchMessages();
        }).catch(err=>{
            alert("AI error or no API key.");
        });
    }else{
        // Normal channel
        fetch(`/upload/${currentChannel}`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username,message,image:base64Image})
        }).then(()=>{
            document.getElementById('message').value='';
            document.getElementById('imageInput').value='';
            fetchMessages();
        });
    }
}

setInterval(fetchMessages,2000);
fetchMessages();