import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models/product.dart';
import '../models/cart_item.dart';
import '../models/customer.dart';
import '../services/pos_service.dart';

final _idrFormat = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  late String orgId;
  late String outletId;
  late String shiftId;

  PosData? _data;
  bool _loading = true;
  String? _loadError;
  final List<CartItem> _cart = [];
  String? _selectedCustomerId;
  List<Product> get _products => _data?.products ?? [];
  Map<String, List<ProductUnit>> get _unitsByProduct => _data?.unitsByProduct ?? {};
  Map<String, String> get _barcodeToProductId => _data?.barcodeToProductId ?? {};
  List<Customer> get _customers => _data?.customers ?? [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null) {
      orgId = args['orgId'] as String;
      outletId = args['outletId'] as String;
      shiftId = args['shiftId'] as String;
    } else {
      orgId = '';
      outletId = '';
      shiftId = '';
    }
    if (orgId.isNotEmpty) _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await PosService.loadPosData(orgId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString();
        _loading = false;
      });
    }
  }

  List<ProductUnit> _unitsForProduct(Product p) {
    final list = _unitsByProduct[p.id];
    if (list != null && list.isNotEmpty) return list;
    return [
      ProductUnit(
        id: p.id,
        productId: p.id,
        unitId: p.defaultUnitId ?? p.id,
        conversionToBase: 1,
        isBase: true,
        symbol: 'pcs',
      ),
    ];
  }

  double? _priceForProductUnit(Product p, String unitId) {
    final units = _unitsForProduct(p);
    final u = units.cast<ProductUnit?>().firstWhere(
          (x) => x?.unitId == unitId,
          orElse: () => null,
        );
    if (u == null) return p.sellingPrice;
    return p.sellingPrice;
  }

  void _addToCart(Product product, {double qty = 1}) {
    final units = _unitsForProduct(product);
    final first = units.first;
    final price = _priceForProductUnit(product, first.unitId) ?? product.sellingPrice;
    final symbol = first.symbol ?? 'pcs';
    final item = CartItem(
      productId: product.id,
      unitId: first.unitId,
      unitSymbol: symbol,
      conversionToBase: first.conversionToBase,
      name: product.name,
      price: price,
      qty: qty,
      replaceVariantId: null,
      replaceVariantName: null,
    );
    final key = item.key;
    final existingIndex = _cart.indexWhere((c) => c.key == key);
    setState(() {
      if (existingIndex >= 0) {
        final existing = _cart[existingIndex];
        _cart[existingIndex] = existing.copyWith(qty: existing.qty + qty);
      } else {
        _cart.add(item);
      }
    });
  }

  bool addToCartByBarcode(String barcode, {double qty = 1}) {
    final code = barcode.trim().toLowerCase();
    if (code.isEmpty || qty < 1) return false;
    final productId = _barcodeToProductId[code];
    if (productId == null) return false;
    Product? product;
    for (final p in _products) {
      if (p.id == productId) {
        product = p;
        break;
      }
    }
    if (product == null || !product.isAvailable) return false;
    _addToCart(product, qty: qty);
    return true;
  }

  void _updateQty(CartItem item, double delta) {
    setState(() {
      final i = _cart.indexWhere((c) => c.key == item.key);
      if (i < 0) return;
      final newQty = (_cart[i].qty + delta).clamp(0.0, double.infinity);
      if (newQty <= 0) {
        _cart.removeAt(i);
      } else {
        _cart[i] = _cart[i].copyWith(qty: newQty);
      }
    });
  }

  void _removeCartItem(CartItem item) {
    setState(() => _cart.removeWhere((c) => c.key == item.key));
  }

  double get _subtotal => _cart.fold(0, (s, c) => s + c.lineTotal);
  double get _total => _subtotal;

  String get _pendingKey => 'hisabia_pos_pending_${orgId}_$outletId';

  Future<void> _savePendingCart() async {
    if (_cart.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_pendingKey);
    List<dynamic> list = [];
    if (existing != null && existing.isNotEmpty) {
      try {
        list = jsonDecode(existing) as List<dynamic>;
      } catch (_) {
        list = [];
      }
    }
    final now = DateTime.now().toIso8601String();
    final id = const Uuid().v4();
    final cartJson = _cart
        .map((c) => {
              'productId': c.productId,
              'unitId': c.unitId,
              'unitSymbol': c.unitSymbol,
              'conversionToBase': c.conversionToBase,
              'name': c.name,
              'price': c.price,
              'qty': c.qty,
              'replaceVariantId': c.replaceVariantId,
              'replaceVariantName': c.replaceVariantName,
            })
        .toList();
    final data = {
      'id': id,
      'createdAt': now,
      'customerId': _selectedCustomerId,
      'cart': cartJson,
    };
    list.add(data);
    await prefs.setString(_pendingKey, jsonEncode(list));
  }

  Future<void> _openPendingList() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_pendingKey);
    if (existing == null || existing.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada transaksi pending.')),
      );
      return;
    }
    List<dynamic> list;
    try {
      list = jsonDecode(existing) as List<dynamic>;
    } catch (_) {
      list = [];
    }
    if (list.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada transaksi pending.')),
      );
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.7,
          maxChildSize: 0.95,
          minChildSize: 0.4,
          builder: (context, scrollController) {
            final items = list.cast<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
            return Column(
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Transaksi Pending',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final p = items[index];
                      final createdAt = p['createdAt'] as String?;
                      final dt = createdAt != null ? DateTime.tryParse(createdAt) : null;
                      final cartList = (p['cart'] as List<dynamic>?) ?? [];
                      double total = 0;
                      for (final raw in cartList) {
                        final m = Map<String, dynamic>.from(raw as Map);
                        final price = (m['price'] as num?)?.toDouble() ?? 0;
                        final qty = (m['qty'] as num?)?.toDouble() ?? 0;
                        total += price * qty;
                      }
                      final firstName = cartList.isNotEmpty
                          ? (Map<String, dynamic>.from(cartList.first as Map)['name'] as String? ?? 'Produk')
                          : 'Kosong';
                      return ListTile(
                        title: Text(firstName),
                        subtitle: Text(
                          '${dt != null ? DateFormat('dd/MM/yyyy HH:mm').format(dt) : '-'} · Total ${_idrFormat.format(total)}',
                        ),
                        onTap: () async {
                          // Restore cart & customer, remove pending entry.
                          final restoredCart = cartList
                              .map((raw) {
                                final m = Map<String, dynamic>.from(raw as Map);
                                return CartItem(
                                  productId: m['productId'] as String,
                                  unitId: m['unitId'] as String,
                                  unitSymbol: m['unitSymbol'] as String,
                                  conversionToBase: (m['conversionToBase'] as num?)?.toDouble() ?? 1,
                                  name: m['name'] as String,
                                  price: (m['price'] as num?)?.toDouble() ?? 0,
                                  qty: (m['qty'] as num?)?.toDouble() ?? 0,
                                  replaceVariantId: m['replaceVariantId'] as String?,
                                  replaceVariantName: m['replaceVariantName'] as String?,
                                );
                              })
                              .where((c) => c.qty > 0)
                              .toList();
                          if (!mounted) return;
                          setState(() {
                            _cart
                              ..clear()
                              ..addAll(restoredCart);
                            _selectedCustomerId = p['customerId'] as String?;
                          });

                          // Remove used pending entry.
                          items.removeAt(index);
                          await prefs.setString(_pendingKey, jsonEncode(items));
                          if (!mounted) return;
                          Navigator.of(ctx).pop();
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _openCheckout() {
    if (_cart.isEmpty) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _CheckoutSheet(
        cart: List.from(_cart),
        subtotal: _subtotal,
        total: _total,
        customers: _customers,
        selectedCustomerId: _selectedCustomerId,
        onSelectCustomer: (id) => setState(() => _selectedCustomerId = id),
        onConfirm: (paymentMethod, discount, payNow, debtFull) async {
          Navigator.pop(ctx);
          await _doCheckout(
            paymentMethod: paymentMethod,
            discount: discount,
            payNow: payNow,
            debtFull: debtFull,
          );
        },
      ),
    );
  }

  Future<void> _doCheckout({
    required String paymentMethod,
    double discount = 0,
    double? payNow,
    bool debtFull = false,
  }) async {
    final total = _subtotal - discount;
    if (total <= 0 || _cart.isEmpty) return;
    try {
      final orderId = await PosService.checkout(
        orgId: orgId,
        outletId: outletId,
        shiftId: shiftId,
        cart: _cart,
        subtotal: _subtotal,
        discount: discount,
        total: total,
        paymentMethod: paymentMethod,
        customerId: _selectedCustomerId,
        debtFull: debtFull,
        payNow: payNow,
      );
      if (orderId == null || !mounted) return;
      await PosService.updateStockAndMovements(
        orgId: orgId,
        orderId: orderId,
        cart: _cart,
        products: _products,
      );
      if (paymentMethod == 'cash' && !debtFull) {
        await PosService.insertCashFlow(orgId, outletId, orderId, total);
      }
      if (paymentMethod == 'credit' && _selectedCustomerId != null) {
        await PosService.insertReceivable(
          orgId: orgId,
          customerId: _selectedCustomerId!,
          orderId: orderId,
          amount: total,
          paid: debtFull ? 0 : (payNow ?? 0),
        );
        final paidAmount = debtFull ? 0.0 : (payNow ?? 0.0);
        if (paidAmount > 0) {
          await PosService.insertCashFlow(orgId, outletId, orderId, paidAmount);
        }
      }
      if (!mounted) return;
      setState(() {
        _cart.clear();
        _selectedCustomerId = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Transaksi berhasil #${orderId.substring(0, 8)}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('POS')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_loadError!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: _loadData, child: const Text('Coba lagi')),
              ],
            ),
          ),
        ),
      );
    }

    final isNarrow = MediaQuery.sizeOf(context).width < 600;
    return WillPopScope(
      onWillPop: () async {
        if (_cart.isEmpty) return true;
        final result = await showDialog<String>(
          context: context,
          builder: (ctx) {
            return AlertDialog(
              title: const Text('Tutup POS'),
              content: const Text(
                  'Ada barang di keranjang. Apa yang ingin Anda lakukan?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop('cancel'),
                  child: const Text('Batal'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop('exit'),
                  child: const Text('Keluar tanpa simpan'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(ctx).pop('save'),
                  child: const Text('Simpan transaksi'),
                ),
              ],
            );
          },
        );
        if (result == 'save') {
          await _savePendingCart();
          return true;
        }
        if (result == 'exit') {
          return true;
        }
        return false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('POS'),
          actions: [
            IconButton(
              icon: const Icon(Icons.inbox),
              tooltip: 'Transaksi pending',
              onPressed: _openPendingList,
            ),
            IconButton(
              icon: const Icon(Icons.qr_code_scanner),
              onPressed: () async {
                final code =
                    await Navigator.pushNamed<String>(context, '/scan');
                if (code != null && code.isNotEmpty) {
                  addToCartByBarcode(code);
                }
              },
            ),
          ],
        ),
        body: isNarrow
          ? Column(
              children: [
                Expanded(
                  child: _ProductsGrid(
                    products: _products,
                    unitsByProduct: _unitsByProduct,
                    onTapProduct: (p) => _addToCart(p),
                  ),
                ),
                SafeArea(
                  child: Material(
                    elevation: 8,
                    child: InkWell(
                      onTap: _cart.isEmpty ? null : () => _showCartSheet(context),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Keranjang: ${_cart.length} item · ${_idrFormat.format(_total)}'),
                            const Icon(Icons.keyboard_arrow_up),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  flex: 3,
                  child: _ProductsGrid(
                    products: _products,
                    unitsByProduct: _unitsByProduct,
                    onTapProduct: (p) => _addToCart(p),
                  ),
                ),
                const VerticalDivider(width: 1),
                SizedBox(
                  width: 320,
                  child: _CartPanel(
                    cart: _cart,
                    products: _products,
                    total: _total,
                    onUpdateQty: _updateQty,
                    onRemove: _removeCartItem,
                    onCheckout: _openCheckout,
                  ),
                ),
              ],
            ),
      ),
    );
  }

  void _showCartSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.95,
        minChildSize: 0.3,
        expand: false,
        builder: (context, scrollController) => _CartPanel(
          scrollController: scrollController,
          cart: _cart,
          products: _products,
          total: _total,
          onUpdateQty: _updateQty,
          onRemove: _removeCartItem,
          onCheckout: () {
            Navigator.pop(ctx);
            _openCheckout();
          },
        ),
      ),
    );
  }
}

class _ProductsGrid extends StatelessWidget {
  final List<Product> products;
  final Map<String, List<ProductUnit>> unitsByProduct;
  final void Function(Product) onTapProduct;

  const _ProductsGrid({
    required this.products,
    required this.unitsByProduct,
    required this.onTapProduct,
  });

  @override
  Widget build(BuildContext context) {
    final available = products.where((p) => p.isAvailable).toList();
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 1.1,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: available.length,
      itemBuilder: (context, i) {
        final p = available[i];
        return Card(
          child: InkWell(
            onTap: () => onTapProduct(p),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    p.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _idrFormat.format(p.sellingPrice),
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CartPanel extends StatelessWidget {
  final List<CartItem> cart;
  final List<Product> products;
  final double total;
  final void Function(CartItem, double) onUpdateQty;
  final void Function(CartItem) onRemove;
  final VoidCallback onCheckout;
  final ScrollController? scrollController;

  const _CartPanel({
    required this.cart,
    required this.products,
    required this.total,
    required this.onUpdateQty,
    required this.onRemove,
    required this.onCheckout,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text('Keranjang (${cart.length})', style: Theme.of(context).textTheme.titleMedium),
        ),
        Expanded(
          child: cart.isEmpty
              ? const Center(child: Text('Keranjang kosong'))
              : ListView.builder(
                  controller: scrollController,
                  itemCount: cart.length,
                  itemBuilder: (context, i) {
                    final item = cart[i];
                    return ListTile(
                      title: Text('${item.displayName} × ${item.qty.toStringAsFixed(item.qty % 1 == 0 ? 0 : 2)}'),
                      subtitle: Text(_idrFormat.format(item.lineTotal)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline),
                            onPressed: () => onUpdateQty(item, -0.5),
                          ),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline),
                            onPressed: () => onUpdateQty(item, 0.5),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => onRemove(item),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Total: ${_idrFormat.format(total)}', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: cart.isEmpty ? null : onCheckout,
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Pembayaran'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CheckoutSheet extends StatefulWidget {
  final List<CartItem> cart;
  final double subtotal;
  final double total;
  final List<Customer> customers;
  final String? selectedCustomerId;
  final void Function(String?) onSelectCustomer;
  final void Function(String paymentMethod, double discount, double? payNow, bool debtFull) onConfirm;

  const _CheckoutSheet({
    required this.cart,
    required this.subtotal,
    required this.total,
    required this.customers,
    required this.selectedCustomerId,
    required this.onSelectCustomer,
    required this.onConfirm,
  });

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  String _paymentMethod = 'cash';
  double _discount = 0;
  double? _payNow;
  bool _debtFull = false;

  @override
  Widget build(BuildContext context) {
    final total = widget.subtotal - _discount;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Total: ${_idrFormat.format(total)}', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _paymentMethod, // ignore: deprecated_member_use
                decoration: const InputDecoration(labelText: 'Metode pembayaran'),
                items: const [
                  DropdownMenuItem(value: 'cash', child: Text('Tunai')),
                  DropdownMenuItem(value: 'transfer', child: Text('Transfer')),
                  DropdownMenuItem(value: 'credit', child: Text('Hutang')),
                ],
                onChanged: (v) => setState(() => _paymentMethod = v ?? 'cash'),
              ),
              const SizedBox(height: 12),
              TextField(
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Diskon (Rp)'),
                onChanged: (v) => setState(() => _discount = double.tryParse(v.replaceAll(',', '.')) ?? 0),
              ),
              if (widget.customers.isNotEmpty) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  value: widget.selectedCustomerId, // ignore: deprecated_member_use
                  decoration: const InputDecoration(labelText: 'Pelanggan'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('—')),
                    ...widget.customers.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))),
                  ],
                  onChanged: (v) => widget.onSelectCustomer(v),
                ),
              ],
              if (_paymentMethod == 'credit') ...[
                const SizedBox(height: 8),
                CheckboxListTile(
                  title: const Text('Bayar penuh nanti (hutang penuh)'),
                  value: _debtFull,
                  onChanged: (v) => setState(() => _debtFull = v ?? false),
                ),
                if (!_debtFull)
                  TextField(
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Bayar sekarang (Rp)'),
                    onChanged: (v) => setState(() => _payNow = double.tryParse(v.replaceAll(',', '.'))),
                  ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => widget.onConfirm(_paymentMethod, _discount, _payNow, _debtFull),
                style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: const Text('Bayar'),
              ),
            ],
          ),
        );
      },
    );
  }
}
