class Product {
  final String id;
  final String name;
  final double stock;
  final double sellingPrice;
  final double costPrice;
  final bool isAvailable;
  final String? defaultUnitId;
  final String? categoryId;
  final String? barcode;

  Product({
    required this.id,
    required this.name,
    required this.stock,
    required this.sellingPrice,
    required this.costPrice,
    required this.isAvailable,
    this.defaultUnitId,
    this.categoryId,
    this.barcode,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      stock: (json['stock'] as num?)?.toDouble() ?? 0,
      sellingPrice: (json['selling_price'] as num?)?.toDouble() ?? 0,
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0,
      isAvailable: json['is_available'] as bool? ?? true,
      defaultUnitId: json['default_unit_id'] as String?,
      categoryId: json['category_id'] as String?,
      barcode: json['barcode'] as String?,
    );
  }
}

class ProductUnit {
  final String id;
  final String productId;
  final String unitId;
  final double conversionToBase;
  final bool isBase;
  final String? symbol;

  ProductUnit({
    required this.id,
    required this.productId,
    required this.unitId,
    required this.conversionToBase,
    required this.isBase,
    this.symbol,
  });

  factory ProductUnit.fromJson(Map<String, dynamic> json) {
    final units = json['units'] as Map<String, dynamic>?;
    return ProductUnit(
      id: json['id'] as String,
      productId: json['product_id'] as String,
      unitId: json['unit_id'] as String,
      conversionToBase: (json['conversion_to_base'] as num?)?.toDouble() ?? 1,
      isBase: json['is_base'] as bool? ?? false,
      symbol: units?['symbol'] as String?,
    );
  }
}
