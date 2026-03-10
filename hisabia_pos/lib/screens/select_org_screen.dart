import 'package:flutter/material.dart';
import '../services/pos_service.dart';

class SelectOrgScreen extends StatefulWidget {
  const SelectOrgScreen({super.key});

  @override
  State<SelectOrgScreen> createState() => _SelectOrgScreenState();
}

class _SelectOrgScreenState extends State<SelectOrgScreen> {
  List<Map<String, dynamic>> _orgs = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await PosService.getMyOrganizations();
      if (!mounted) return;
      setState(() {
        _orgs = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _selectOrg(Map<String, dynamic> org) async {
    final orgId = org['organization_id'] as String? ?? org['id'] as String?;
    if (orgId == null) return;
    final outlets = await PosService.getOutlets(orgId);
    if (!mounted) return;
    if (outlets.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Belum ada outlet. Tambah outlet di web.')),
      );
      return;
    }
    final outlet = outlets.first;
    final outletId = outlet['id'] as String;
    final outletName = outlet['name'] as String? ?? 'Outlet';
    Navigator.of(context).pushReplacementNamed(
      '/shift',
      arguments: {
        'orgId': orgId,
        'orgName': org['name'] as String? ?? 'Toko',
        'outletId': outletId,
        'outletName': outletName,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pilih Toko'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await PosService.signOut();
              if (!mounted) return;
              Navigator.of(context).pushNamedAndRemoveUntil('/login', (r) => false);
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.red)),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _load, child: const Text('Coba lagi')),
                      ],
                    ),
                  ),
                )
              : _orgs.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Belum ada toko.', style: TextStyle(color: Colors.grey[600])),
                          const SizedBox(height: 8),
                          FilledButton(onPressed: _load, child: const Text('Refresh')),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _orgs.length,
                      itemBuilder: (context, i) {
                        final org = _orgs[i];
                        final name = org['name'] as String? ?? 'Toko';
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: ListTile(
                            title: Text(name),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => _selectOrg(org),
                          ),
                        );
                      },
                    ),
    );
  }
}
