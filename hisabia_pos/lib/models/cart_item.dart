class CartItem {
  final String productId;
  final String unitId;
  final String unitSymbol;
  final double conversionToBase;
  final String name;
  final double price;
  final double qty;
  final String? replaceVariantId;
  final String? replaceVariantName;

  CartItem({
    required this.productId,
    required this.unitId,
    required this.unitSymbol,
    required this.conversionToBase,
    required this.name,
    required this.price,
    required this.qty,
    this.replaceVariantId,
    this.replaceVariantName,
  });

  CartItem copyWith({double? qty}) {
    return CartItem(
      productId: productId,
      unitId: unitId,
      unitSymbol: unitSymbol,
      conversionToBase: conversionToBase,
      name: name,
      price: price,
      qty: qty ?? this.qty,
      replaceVariantId: replaceVariantId,
      replaceVariantName: replaceVariantName,
    );
  }

  String get displayName {
    if (replaceVariantName != null && replaceVariantName!.isNotEmpty) {
      return '$name - $replaceVariantName';
    }
    return name;
  }

  double get lineTotal => price * qty;

  String get key => '$productId-$unitId-${replaceVariantId ?? ""}';
}
