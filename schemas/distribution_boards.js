import { Schema, model } from "mongoose";

const distributionBoardSchema = new Schema(
    {
        producer: {
            type: String,
        },
        model: {
            type: String,
        },
        type: {
            type: String,
        },
        mounting_type: {
            type: String,
        },
        module_count: {
            type: Number,
        },
        max_input_voltage_V: {
            type: Number,
        },
        price: {
            type: Number,
        }
    }
)

const DistributionBoards = model("distribution_boards", distributionBoardSchema);

export default DistributionBoards;