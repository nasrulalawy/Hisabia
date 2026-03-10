import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/supabase_config.dart';
import '../models/product.dart';
import '../models/cart_item.dart';
import '../models/category.dart';
import '../models/customer.dart';
import '../models/shift.dart';

class PosService {
  static SupabaseClient get _client => Supabase.instance.client;

  static Future<void> init() async {
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  }

  static User? get currentUser => _client.auth.currentUser;

  static Future<AuthResponse> signIn(String email, String password) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  static Future<void> signOut() => _client.auth.signOut();

  /// Ambil daftar org yang user punya akses (anggota).
  static Future<List<Map<String, dynamic>>> getMyOrganizations() async {
    final userId = currentUser?.id;
    if (userId == null) return [];
    final res = await _client
        .from('organization_members')
        .select('organization_id, organizations(id, name)')
        .eq('user_id', userId);
    final list = res as List<dynamic>? ?? [];
    return list.map((e) {
      final m = e as Map<String, dynamic>;
      final org = m['organizations'] as Map<String, dynamic>?;
      return {
        'organization_id': m['organization_id'],
        'id': org?['id'],
        'name': org?['name'] as String? ?? 'Toko',
      };
    }).toList();
  }

  /// Outlets untuk satu org.
  static Future<List<Map<String, dynamic>>> getOutlets(String orgId) async {
    final res = await _client
        .from('outlets')
        .select('id, name, is_default')
        .eq('organization_id', orgId)
        .order('is_default', ascending: false);
    return (res as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
  }

  /// Shift aktif untuk outlet (satu per outlet).
  static Future<Shift?> getActiveShift(String outletId) async {
    final res = await _client
        .from('shifts')
        .select('id, initial_cash, opened_at')
        .eq('outlet_id', outletId)
        .isFilter('closed_at', null)
        .maybeSingle();
    if (res == null) return null;
    return Shift.fromJson(Map<String, dynamic>.from(res as Map));
  }

  static Future<Shift> openShift(String orgId, String outletId, double initialCash, {String? notes}) async {
    final res = await _client
        .from('shifts')
        .insert({
          'organization_id': orgId,
          'outlet_id': outletId,
          'opened_by': currentUser?.id,
          'initial_cash': initialCash,
          'notes': notes,
        })
        .select('id, initial_cash, opened_at')
        .single();
    return Shift.fromJson(Map<String, dynamic>.from(res as Map));
  }

  static Future<void> closeShift(String shiftId, double endCash) async {
    await _client.from('shifts').update({
      'closed_at': DateTime.now().toIso8601String(),
      'end_cash': endCash,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', shiftId);
  }

  /// Produk + product_units + product_barcodes untuk lookup.
  static Future<PosData> loadPosData(String orgId) async {
    final productsRes = await _client
        .from('products')
        .select('id, name, stock, selling_price, cost_price, is_available, default_unit_id, category_id, barcode')
        .eq('organization_id', orgId)
        .order('name');
    final products = (productsRes as List<dynamic>?)
            ?.map((e) => Product.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final ids = products.map((p) => p.id).toList();
    Map<String, List<ProductUnit>> unitsByProduct = {};
    if (ids.isNotEmpty) {
      final puRes = await _client
          .from('product_units')
          .select('id, product_id, unit_id, conversion_to_base, is_base, units(name, symbol)')
          .inFilter('product_id', ids);
      final puList = (puRes as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      for (final p in products) {
        unitsByProduct[p.id] = puList
            .where((u) => u['product_id'] == p.id)
            .map((u) => ProductUnit.fromJson(u))
            .toList();
      }
    }

    final barcodeRes = await _client
        .from('product_barcodes')
        .select('product_id, barcode')
        .eq('organization_id', orgId);
    final barcodeList = (barcodeRes as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    final barcodeToProductId = <String, String>{};
    for (final r in barcodeList) {
      final code = (r['barcode'] as String?)?.trim().toLowerCase();
      if (code != null && code.isNotEmpty) barcodeToProductId[code] = r['product_id'] as String;
    }
    for (final p in products) {
      final b = p.barcode?.trim().toLowerCase();
      if (b != null && b.isNotEmpty && !barcodeToProductId.containsKey(b)) {
        barcodeToProductId[b] = p.id;
      }
    }

    final catRes = await _client
        .from('menu_categories')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
    final categories = (catRes as List<dynamic>?)
            ?.map((e) => Category.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final custRes = await _client
        .from('customers')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
    final customers = (custRes as List<dynamic>?)
            ?.map((e) => Customer.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return PosData(
      products: products,
      unitsByProduct: unitsByProduct,
      barcodeToProductId: barcodeToProductId,
      categories: categories,
      customers: customers,
    );
  }

  /// Checkout: order + order_items + update stock + cash_flow + receivable (jika hutang).
  static Future<String?> checkout({
    required String orgId,
    required String outletId,
    required String shiftId,
    required List<CartItem> cart,
    required double subtotal,
    required double discount,
    required double total,
    required String paymentMethod,
    String? customerId,
    String? notes,
    bool debtFull = false,
    double? payNow,
  }) async {
    final userId = currentUser?.id;
    final tax = 0.0;

    final orderRes = await _client.from('orders').insert({
      'organization_id': orgId,
      'outlet_id': outletId,
      'shift_id': shiftId,
      'created_by': userId,
      'customer_id': customerId,
      'status': 'paid',
      'subtotal': subtotal,
      'tax': tax,
      'discount': discount,
      'total': total,
      'payment_method': debtFull ? 'credit' : paymentMethod,
      'notes': notes,
    }).select('id').single();

    final orderId = orderRes['id'] as String?;
    if (orderId == null) return null;

    final items = cart.map((c) {
      return {
        'order_id': orderId,
        'menu_item_id': null,
        'product_id': c.productId,
        'product_variant_id': c.replaceVariantId,
        'unit_id': c.unitId,
        'name': '${c.displayName} (${c.unitSymbol})',
        'price': c.price,
        'quantity': c.qty.toInt(),
        'notes': null,
      };
    }).toList();

    try {
      await _client.from('order_items').insert(items);
    } catch (_) {
      await _client.from('orders').delete().eq('id', orderId);
      return null;
    }

    return orderId;
  }

  /// Update stok dan stock_movements setelah order (panggil setelah checkout sukses).
  static Future<void> updateStockAndMovements({
    required String orgId,
    required String orderId,
    required List<CartItem> cart,
    required List<Product> products,
  }) async {
    for (final c in cart) {
      Product? product;
      for (final p in products) {
        if (p.id == c.productId) {
          product = p;
          break;
        }
      }
      if (product == null) continue;
      final qtyBase = c.qty * c.conversionToBase;
      final newStock = (product.stock - qtyBase).clamp(0.0, double.infinity);
      await _client.from('products').update({
        'stock': newStock,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', c.productId);

      await _client.from('stock_movements').insert({
        'organization_id': orgId,
        'warehouse_id': null,
        'product_id': c.productId,
        'type': 'out',
        'quantity': qtyBase,
        'notes': 'Penjualan POS #${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)} (${c.qty} ${c.unitSymbol})',
      });
    }
  }

  static Future<void> insertCashFlow(String orgId, String outletId, String orderId, double amount) async {
    if (amount <= 0) return;
    await _client.from('cash_flows').insert({
      'organization_id': orgId,
      'outlet_id': outletId,
      'type': 'in',
      'amount': amount,
      'description': 'Penjualan POS #${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)}',
      'reference_type': 'order',
      'reference_id': orderId,
    });
  }

  static Future<void> insertReceivable({
    required String orgId,
    required String customerId,
    required String orderId,
    required double amount,
    required double paid,
    String? notes,
  }) async {
    if (amount <= paid) return;
    await _client.from('receivables').insert({
      'organization_id': orgId,
      'customer_id': customerId,
      'order_id': orderId,
      'amount': amount,
      'paid': paid,
      'notes': notes ?? 'Order #${orderId.substring(0, orderId.length > 8 ? 8 : orderId.length)}',
    });
  }
}

class PosData {
  final List<Product> products;
  final Map<String, List<ProductUnit>> unitsByProduct;
  final Map<String, String> barcodeToProductId;
  final List<Category> categories;
  final List<Customer> customers;

  PosData({
    required this.products,
    required this.unitsByProduct,
    required this.barcodeToProductId,
    required this.categories,
    required this.customers,
  });
}
