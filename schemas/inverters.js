import { Schema, model } from 'mongoose';

const inverterSchema = new Schema(
    {
        producer: {
            type: String,
        },
        model: {
            type: String,
        },
        type: {
            type: String,
            enum: ['off-grid', 'hybrid', 'on-grid']
        },
        phases_count: {
            type: Number,
            enum: [1, 3]
        },
        efficiency: {
            type: Number,
        },
        nominal_power_dc_kW: {
            type: Number,
        },
        max_power_dc_kW: {
            type: Number,
        },
        input_voltage_range_dc_v: {
            min: Number,
            max: Number
        },
        mppt_voltage_range_v: {
            min: Number,
            max: Number
        },
        max_input_voltage_v: {
            type: Number,
        },
        input_current_a: {
            type: [Number],
        },
        max_mppt_current_a: {
            type: Number,
        },
        battery_voltage_v: {
            type: Number,
        },
        max_charge_current_a: {
            type: Number,
        },
        price: {
            type: Number,
        },
    }
)

const Inverters = model("inverters", inverterSchema)

export default Inverters;