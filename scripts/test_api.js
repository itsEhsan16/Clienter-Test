const http = require('http')
http
  .get('http://localhost:3001/api/projects', (res) => {
    console.log('status', res.statusCode)
    let data = ''
    res.on('data', (c) => (data += c))
    res.on('end', () => {
      console.log('\n---END---\n', data)
    })
  })
  .on('error', (e) => console.error('error', e))
