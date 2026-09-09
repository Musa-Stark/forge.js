import { getModel } from "../../dist/js/index.js"

const recentHandler = async (title, type) => {
    const Model = getModel({model: "Recent"})

    await Model.create({title, type})
}

export default recentHandler;