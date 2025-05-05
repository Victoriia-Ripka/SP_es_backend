import { Schema, model } from "mongoose";

const chargeSchema = new Schema(
    {
        producer: {
            type: String,
        },
        seria: {
            type: String,
        },
        model: {
            type: String,
        },
        max_input_voltage_V: {
            type: Number
        },
        efficiency: {
            type: Number,
        },
        depth_of_discharge_percent: {
            type: Number,
        },
        battery_technology: {
            type: String,
        },
        weight_kg: {
            type: Number,
        },
        battery_block_capacity_kWh: {
            type: Number,
        },
        battery_capacity_kWh: {
            type: Number,
        },
        nominal_voltage_V: {
            type: Number,
        },
        voltage_range_V: {
            min: Number,
            max: Number
        },
        min_input_voltage_V: {
            type: Number,
        },
        max_input_power_kW: {
            type: Number,
        },
        nominal_output_power_AC_kW: {
            type: Number,
        },
        max_output_power_AC_kW: {
            type: Number,
        },
        max_current_AC_A: {
            type: Number,
        },
        price: {
            type: Number,
        },
    }
)

const Charges = model("charges", chargeSchema);

export default Charges;