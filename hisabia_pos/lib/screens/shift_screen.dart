import 'package:flutter/material.dart';
import '../models/shift.dart';
import '../services/pos_service.dart';

class ShiftScreen extends StatefulWidget {
  const ShiftScreen({super.key});

  @override
  State<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends State<ShiftScreen> {
  late String orgId;
  late String orgName;
  late String outletId;
  late String outletName;

  Shift? _activeShift;
  bool _loading = true;
  bool _opening = false;
  final _initialCashController = TextEditingController(text: '0');

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null) {
      orgId = args['orgId'] as String;
      orgName = args['orgName'] as String? ?? 'Toko';
      outletId = args['outletId'] as String;
      outletName = args['outletName'] as String? ?? 'Outlet';
    } else {
      orgId = '';
      orgName = '';
      outletId = '';
      outletName = '';
    }
    _loadShift();
  }

  Future<void> _loadShift() async {
    if (outletId.isEmpty) return;
    setState(() => _loading = true);
    try {
      final shift = await PosService.getActiveShift(outletId);
      if (!mounted) return;
      setState(() {
        _activeShift = shift;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _openShift() async {
    final value = double.tryParse(_initialCashController.text.replaceAll(',', '.')) ?? 0;
    setState(() => _opening = true);
    try {
      final shift = await PosService.openShift(orgId, outletId, value);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(
        '/pos',
        arguments: {
          'orgId': orgId,
          'orgName': orgName,
          'outletId': outletId,
          'outletName': outletName,
          'shiftId': shift.id,
        },
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      setState(() => _opening = false);
    }
  }

  @override
  void dispose() {
    _initialCashController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(outletName),
            Text(orgName, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _activeShift != null
              ? _buildShiftOpenContent()
              : _buildOpenShiftForm(),
    );
  }

  Widget _buildShiftOpenContent() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 16),
            const Text('Shift sudah dibuka', style: TextStyle(fontSize: 18)),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pushReplacementNamed(
                  '/pos',
                  arguments: {
                    'orgId': orgId,
                    'orgName': orgName,
                    'outletId': outletId,
                    'outletName': outletName,
                    'shiftId': _activeShift!.id,
                  },
                );
              },
              child: const Text('Buka POS'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOpenShiftForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Buka shift kasir', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          TextField(
            controller: _initialCashController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Saldo awal kas (Rp)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _opening ? null : _openShift,
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
            child: _opening
                ? const SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Buka Shift'),
          ),
        ],
      ),
    );
  }
}
