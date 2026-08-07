import type { Route } from "../../types/Collection.ts"
import AppError from "../../utils/AppError.js"

// const handleEncryption = async (body: any, routeObj: Route) => {
//     if (!Array.isArray(routeObj)) throw new AppError({
        
//     })
// }
/*
{
  method: 'post',
  path: '/',
  handler: 'create',
  authRole: 'authenticated',
  validationKey: 'createProduct',
  encryptedFieldsArray: [ 'cardNumber' ]
}
{
  name: 'laptop',
  price: 123,
  category: [ { name: 'musa', expiry: '123' } ],
  isAvailable: true,
  cardNumber: '123456789'
}*/ 

// export default handleEncryption