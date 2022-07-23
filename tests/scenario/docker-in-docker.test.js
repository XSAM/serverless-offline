import assert from 'node:assert'
import { platform } from 'node:os'
import { dirname, resolve } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { BASE_URL } from '../config.js'
import installNpmModules from '../installNpmModules.js'
import { compressArtifact } from '../integration/_testHelpers/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe.skip('docker in docker', function desc() {
  before(async () => {
    await installNpmModules(resolve(__dirname, 'docker-in-docker'))
  })

  beforeEach(async () => {
    await Promise.all([
      compressArtifact(
        resolve(__dirname, 'docker-in-docker'),
        './artifacts/hello.zip',
        ['./handler.js'],
      ),
      compressArtifact(
        resolve(__dirname, 'docker-in-docker'),
        './artifacts/layer.zip',
        ['./handler.sh'],
      ),
    ])

    const composeFileArgs = ['-f', 'docker-compose.yml']
    if (platform() === 'linux') {
      composeFileArgs.push('-f', 'docker-compose.linux.yml')
    }

    const composeProcess = execa('docker-compose', [...composeFileArgs, 'up'], {
      all: true,
      cwd: resolve(__dirname, 'docker-in-docker'),
      env: {
        HOST_SERVICE_PATH: resolve(__dirname, 'docker-in-docker'),
      },
    })

    return new Promise((res) => {
      composeProcess.all.on('data', (data) => {
        console.log(String(data))

        if (String(data).includes('Server ready:')) {
          res()
        }
      })
    })
  })

  afterEach(async () => {
    return execa('docker-compose', ['down'], {
      cwd: resolve(__dirname, 'docker-in-docker'),
    })
  })

  //
  ;[
    {
      description: 'should work with docker in docker',
      expected: {
        message: 'Hello Node.js 12.x!',
      },
      path: '/dev/hello',
    },
    {
      description: 'should work with artifact with docker in docker',
      expected: {
        message: 'Hello Node.js 12.x!',
      },
      path: '/dev/artifact',
    },
    {
      description: 'should work with layer with docker in docker',
      expected: {
        message: 'Hello from Bash!',
      },
      path: '/dev/layer',
    },
    {
      description: 'should work with artifact and layer with docker in docker',
      expected: {
        message: 'Hello from Bash!',
      },
      path: '/dev/artifact-with-layer',
    },
  ].forEach(({ description, expected, path }) => {
    it(description, async function it() {
      if (!env.DOCKER_COMPOSE_DETECTED) {
        this.skip()
      }

      const url = new URL(path, BASE_URL)
      const response = await fetch(url)
      const json = await response.json()

      assert.deepEqual(json.message, expected.message)
    })
  })
})
