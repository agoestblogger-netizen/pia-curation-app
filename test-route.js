fetch('http://localhost:3000/regional-judge/assess/1')
  .then(r => console.log(r.status, r.url))
  .catch(e => console.error(e))
