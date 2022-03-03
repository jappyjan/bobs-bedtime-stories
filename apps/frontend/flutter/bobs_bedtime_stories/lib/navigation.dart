import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import './now-playing.dart';

class BobsNavigation extends HookWidget {
  final ValueNotifier<int> activeTab;

  const BobsNavigation({Key? key, required this.activeTab}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      currentIndex: activeTab.value,
      onTap: (tappedItem) => {
        if (tappedItem != 1)
          {
            activeTab.value = tappedItem,
          }
        else
          {
            showModalBottomSheet<void>(
              context: context,
              builder: (BuildContext context) {
                return const NowPlaying();
              },
            )
          }
      },
      items: const [
        BottomNavigationBarItem(
            icon: Icon(Icons.library_books_outlined),
            label: 'Geschichten'),
        BottomNavigationBarItem(
          icon: Icon(Icons.headphones),
          label: 'Es läuft',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.mic),
          label: 'Aufnahme',
        ),
      ],
    );
  }
}
