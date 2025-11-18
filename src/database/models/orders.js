import mongoose from "mongoose";

const schema = new mongoose.Schema({
    OrderId: { type: String, unique: true },
    OrderStatus: { type: String },
    PurchaseDate: { type: String },
    BuyerInfo: { type: mongoose.Schema.Types.Mixed },
    ShippingAddress: { type: mongoose.Schema.Types.Mixed },
    OrderErrors: { type: mongoose.Schema.Types.Mixed },
    IsPosted: { type: Boolean, default: false },
},
    { timestamps: true }
);
const Orders = mongoose.model("orders", schema);

export default Orders;