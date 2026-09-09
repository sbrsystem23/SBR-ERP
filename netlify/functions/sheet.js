const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwF01VM_NXs7WiBznpfkZoTDUzwQihm9gZQH7qkavY1SPPA9CykIrXO-7ZyR68uQZ1_/exec';
exports.handler = async function(event, context) {
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json'};
  if (event.httpMethod === 'OPTIONS') return {statusCode:200,headers,body:''};
  try {
    let response, text;
    if (event.httpMethod === 'GET') { response = await fetch(SHEET_URL+'?action=load&t='+Date.now(),{redirect:'follow'}); text = await response.text(); }
    else if (event.httpMethod === 'POST') { const body=JSON.parse(event.body); response=await fetch(SHEET_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'follow'}); text=await response.text(); }
    let data; try{data=JSON.parse(text);}catch(e){return{statusCode:200,headers,body:JSON.stringify({status:'error',error:'Invalid JSON',raw:text.substring(0,200)})};}
    return {statusCode:200,headers,body:JSON.stringify(data)};
  } catch(err) { return {statusCode:500,headers,body:JSON.stringify({status:'error',error:err.message})}; }
};
