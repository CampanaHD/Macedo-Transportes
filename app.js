const SUPABASE_URL =
'https://httesayqbjeqgkdnkyak.supabase.co'

const SUPABASE_KEY =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dGVzYXlxYmplcWdrZG5reWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTA1NTEsImV4cCI6MjA5NDg2NjU1MX0.CAyjBpq4Wg6vGwjg-9lFosjNo7B9kX87F929qhwGf9Y'

const client =
window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
)

let viagens = []
let viagemAtual = null

function agoraBrasil(){

const agora = new Date()

const data =
agora.toLocaleDateString('sv-SE')

const hora =
agora.toLocaleTimeString(
'pt-BR',
{
hour12:false
}
)

return `${data} ${hora}`
}

function mostrarTela(tela){

document
.querySelectorAll('[id$="Tela"]')
.forEach(el=>el.classList.add('hidden'))

document
.getElementById(tela+'Tela')
.classList.remove('hidden')
}

async function carregar(){

const { data: motoristas } =
await client
.from('motoristas')
.select('*')

const { data: veiculos } =
await client
.from('veiculos')
.select('*')

const { data: viagensData } =
await client
.from('viagens')
.select('*')
.order('numero',{
ascending:false
})
.limit(10)

viagens = viagensData || []

document.getElementById('placa').innerHTML =
'<option>Selecione placa</option>'

document.getElementById('placaBaixa').innerHTML =
'<option>Selecione a placa</option>'

veiculos.forEach(v=>{

document.getElementById('placa').innerHTML += `
<option value="${v.placa}">
${v.placa}
</option>
`

})

viagens
.filter(v=>v.status==='FINALIZADA')
.forEach(v=>{

document.getElementById('placaBaixa').innerHTML += `
<option value="${v.placa}">
${v.placa}
</option>
`
})

document.getElementById('motorista').innerHTML =
'<option>Selecione motorista</option>'

motoristas.forEach(m=>{

document.getElementById('motorista').innerHTML += `
<option value="${m.cpf}">
${m.nome}
</option>
`

})

render()
}

async function criarViagem(){

const placa =
document.getElementById('placa').value

const cpf =
document.getElementById('motorista').value

if(
placa === 'Selecione placa' ||
cpf === 'Selecione motorista'
){
Swal.fire('Preencha os campos')
return
}

const { data: motorista } =
await client
.from('motoristas')
.select('*')
.eq('cpf', cpf)
.single()

await client
.from('viagens')
.insert([{
placa,
motorista:motorista.nome,
cpf_motorista:cpf,
status:'ABERTA',
created_at:agoraBrasil()
}])

Swal.fire('Viagem criada')

carregar()
}

function render(){

const filtro =
document.getElementById('filtro').value.toLowerCase()

const filtroStatus =
document.getElementById('filtroStatus').value

const filtroData =
document.getElementById('filtroData').value

const lista =
document.getElementById('lista')

lista.innerHTML=''

document.getElementById('abertas').innerText =
viagens.filter(v=>v.status==='ABERTA').length

document.getElementById('finalizadas').innerText =
viagens.filter(v=>v.status==='FINALIZADA').length

document.getElementById('canceladas').innerText =
viagens.filter(v=>v.status==='CANCELADA').length

viagens
.filter(v=>{

const texto =
(v.placa||'').toLowerCase().includes(filtro)
||
(v.motorista||'').toLowerCase().includes(filtro)

const status =
!filtroStatus || v.status===filtroStatus

const dataViagem =
v.created_at
? v.created_at.substring(0,10)
: ''

const dataOk =
!filtroData || dataViagem===filtroData

return texto && status && dataOk

})
.forEach(v=>{

lista.innerHTML += `
<tr>
<td>${v.numero}</td>
<td>${v.placa}</td>
<td>${v.motorista}</td>

<td>
<span class="status-${v.status.toLowerCase()}">
${v.status}
</span>

<div class="data-info">Abertura: ${v.created_at||'-'}</div>
<div class="data-info">Finalização: ${v.finalizado_em||'-'}</div>
<div class="data-info">Cancelamento: ${v.cancelado_em||'-'}</div>
</td>

<td>
${
v.status==='ABERTA'
?
`<button class="btn-cte" onclick="abrir(${v.numero})">CT-es</button>`
:
`<button class="btn-pdf" onclick="abrirPdf(${v.numero})">PDF</button>`
}
</td>

<td>
${
v.status==='ABERTA'
?
`<button class="btn-cancelar" onclick="cancelar('${v.id}')">Cancelar</button>`
:
v.status
}
</td>
</tr>
`
})
}

async function abrir(numero){

viagemAtual =
viagens.find(v=>v.numero===numero)

if(!viagemAtual) return

document.getElementById('modal')
.classList.remove('hidden')

document.getElementById('tituloViagem')
.innerText='Viagem #'+viagemAtual.numero

renderDocs()
}

function fechar(){
document.getElementById('modal')
.classList.add('hidden')
}

async function scanner(e){

if(e.key!=='Enter') return

const chave =
document.getElementById('scanner').value.trim()

if(chave.length!==44){
Swal.fire('Chave inválida')
return
}

await client
.from('documentos')
.insert([{
viagem_id:viagemAtual.id,
chave_cte:chave,
numero_cte:chave.substring(25,34),
emitente:'Consulta Gratuita',
cidade:'Marília/SP',
status_entrega:'EM ROTA',
data_saida:agoraBrasil()
}])

document.getElementById('scanner').value=''

Swal.fire('CT-e lançado')

renderDocs()
}

async function renderDocs(){

const { data: docs } =
await client
.from('documentos')
.select('*')
.eq('viagem_id',viagemAtual.id)

const tbody =
document.getElementById('docs')

tbody.innerHTML=''

docs.forEach(d=>{

tbody.innerHTML += `
<tr>
<td>${d.numero_cte}</td>
<td>${d.emitente}</td>
<td>${d.cidade}</td>
<td>
<button class="btn-cancelar"
onclick="remover('${d.id}')">
Remover
</button>
</td>
</tr>
`
})
}

async function remover(id){

await client
.from('documentos')
.delete()
.eq('id',id)

renderDocs()
}

async function cancelar(id){

await client
.from('viagens')
.update({
status:'CANCELADA',
cancelado_em:agoraBrasil()
})
.eq('id',id)

carregar()
}

async function finalizar(){

await client
.from('viagens')
.update({
status:'FINALIZADA',
finalizado_em:agoraBrasil()
})
.eq('id',viagemAtual.id)

fechar()
carregar()
}

async function abrirPdf(numero){

viagemAtual =
viagens.find(v=>v.numero===numero)

pdf()
}

async function pdf(){

const { jsPDF } = window.jspdf
const doc = new jsPDF()

doc.setFontSize(20)
doc.text('ROMANEIO',20,20)

doc.setFontSize(12)
doc.text('Viagem: '+viagemAtual.numero,20,40)
doc.text('Placa: '+viagemAtual.placa,20,50)
doc.text('Motorista: '+viagemAtual.motorista,20,60)

const { data: docs } =
await client
.from('documentos')
.select('*')
.eq('viagem_id',viagemAtual.id)

let y=90

docs.forEach((d,index)=>{
doc.text(`${index+1} - ${d.numero_cte}`,20,y)
y+=10
})

doc.save(`ROMANEIO-${viagemAtual.numero}.pdf`)
}

async function listarPendentes(){

const placa =
document.getElementById('placaBaixa').value

const viagem =
viagens.find(v=>v.placa===placa)

if(!viagem) return

const { data: docs } =
await client
.from('documentos')
.select('*')
.eq('viagem_id',viagem.id)

let html=''

docs.forEach(d=>{

if(d.status_entrega==='ENTREGUE') return

html += `
<div class="card">
<p><b>CT-e:</b> ${d.numero_cte}</p>
<p>Saída: ${d.data_saida||'-'}</p>

<input id="rec-${d.id}" placeholder="Nome recebedor">
<input id="doc-${d.id}" placeholder="Documento">

<button class="btn-finalizar"
onclick="registrarBaixa('${d.id}')">
Registrar Baixa
</button>
</div>
`
})

document.getElementById('listaPendentes').innerHTML=html
}

async function registrarBaixa(id){

const recebedor =
document.getElementById(`rec-${id}`).value

const documento =
document.getElementById(`doc-${id}`).value

await client
.from('documentos')
.update({
status_entrega:'ENTREGUE',
data_baixa:agoraBrasil(),
recebedor,
documento_recebedor:documento
})
.eq('id',id)

Swal.fire('Baixa registrada')

listarPendentes()
}

async function rastrearCte(){

const numero =
document.getElementById('buscarCte').value

const { data } =
await client
.from('documentos')
.select('*')
.eq('numero_cte',numero)

const div =
document.getElementById('resultadoRastreio')

if(!data.length){
div.innerHTML='CT-e não encontrado'
return
}

const cte = data[0]

div.innerHTML=`
<div class="card">
<p><b>CT-e:</b> ${cte.numero_cte}</p>
<p><b>Status:</b> ${cte.status_entrega}</p>
<p><b>Saída:</b> ${cte.data_saida||'-'}</p>
<p><b>Baixa:</b> ${cte.data_baixa||'-'}</p>
<p><b>Recebedor:</b> ${cte.recebedor||'-'}</p>
</div>
`
}

carregar()
