import { resolve as resolvePath } from 'path'
import { readFile, readdirSync } from 'fs'
import { GraphQLSchema, printSchema, graphql } from 'graphql'
import { Inventory } from '../../interface'
import getTestPGClient from '../../postgres/__tests__/fixtures/getTestPGClient'
import { introspectDatabase } from '../../postgres/introspection'
import addPGToInventory from '../../postgres/inventory/addPGToInventory'
import createSchema from '../../graphql/schema/createSchema'

const kitchenSinkData = new Promise((resolve, reject) => {
  readFile(resolvePath(__dirname, '../../../resources/kitchen-sink-data.sql'), (error, data) => {
    if (error) reject(error)
    else resolve(data.toString())
  })
})

/**
 * @type {GraphQLSchema}
 */
let schema1, schema2

beforeAll(async () => {
  const client = await getTestPGClient()
  const catalog = await introspectDatabase(client, ['a', 'b', 'c'])

  const inventory1 = new Inventory()
  addPGToInventory(inventory1, catalog)
  schema1 = createSchema(inventory1)

  const inventory2 = new Inventory()
  addPGToInventory(inventory2, catalog, { renameIdToRowId: true })
  schema2 = createSchema(inventory2, { nodeIdFieldName: 'id' })
})

test('schema', async () => {
  expect(printSchema(schema1)).toMatchSnapshot()
  expect(printSchema(schema2)).toMatchSnapshot()
})

const queriesDir = resolvePath(__dirname, 'fixtures/queries')

for (const file of readdirSync(queriesDir)) {
  test(`query ${file}`, async () => {
    const query = await (new Promise((resolve, reject) => {
      readFile(resolvePath(queriesDir, file), (error, data) => {
        if (error) reject(error)
        else resolve(data.toString())
      })
    }))

    const client = await getTestPGClient()

    // Add test data…
    await client.query(await kitchenSinkData)

    const result = await graphql(schema1, query, null, { client })

    expect(result).toMatchSnapshot()
  })
}
